
package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"nexora.local/nexora/services/api/internal/auth"
	"nexora.local/nexora/services/api/internal/db"
)

func readHidden(prompt string) (string, error) {
	fmt.Fprint(os.Stderr, prompt)
	fd := int(os.Stdin.Fd())
	var old syscall.Termios

	_, _, errno := syscall.Syscall(syscall.SYS_IOCTL, uintptr(fd),
		uintptr(syscall.TCGETS), uintptr(unsafe.Pointer(&old)))
	if errno != 0 {
		return "", fmt.Errorf("hidden terminal input is required")
	}

	hidden := old
	hidden.Lflag &^= syscall.ECHO
	_, _, errno = syscall.Syscall(syscall.SYS_IOCTL, uintptr(fd),
		uintptr(syscall.TCSETS), uintptr(unsafe.Pointer(&hidden)))
	if errno != 0 {
		return "", fmt.Errorf("cannot enable hidden password input")
	}

	defer func() {
		_, _, _ = syscall.Syscall(syscall.SYS_IOCTL, uintptr(fd),
			uintptr(syscall.TCSETS), uintptr(unsafe.Pointer(&old)))
		fmt.Fprintln(os.Stderr)
	}()

	value, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && len(value) == 0 {
		return "", fmt.Errorf("could not read password")
	}
	return strings.TrimSuffix(strings.TrimSuffix(value, "\n"), "\r"), nil
}

func run() error {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return fmt.Errorf("DATABASE_URL is not configured")
	}

	password, err := readHidden("New admin password (hidden): ")
	if err != nil {
		return err
	}
	confirmation, err := readHidden("Confirm new password (hidden): ")
	if err != nil {
		return err
	}
	if password != confirmation {
		return fmt.Errorf("passwords do not match")
	}

	hash, err := auth.HashPassword(password)
	password, confirmation = "", ""
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.Connect(ctx, databaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	rows, err := tx.Query(ctx, `
		SELECT o.id::text, u.id::text
		FROM organizations o
		JOIN users u ON u.organization_id = o.id
		WHERE o.slug = $1 AND u.role = 'admin' AND u.active = true
		FOR UPDATE OF u
	`, "example")
	if err != nil {
		return err
	}

	type account struct {
		orgID  string
		userID string
	}
	var accounts []account

	for rows.Next() {
		var a account
		if err := rows.Scan(&a.orgID, &a.userID); err != nil {
			rows.Close()
			return err
		}
		accounts = append(accounts, a)
	}
	rowsErr := rows.Err()
	rows.Close()
	if rowsErr != nil {
		return rowsErr
	}
	if len(accounts) != 1 {
		return fmt.Errorf("expected exactly one active admin; found %d; no changes made", len(accounts))
	}

	a := accounts[0]
	tag, err := tx.Exec(ctx, `
		UPDATE users SET password_hash = $1
		WHERE id = $2 AND organization_id = $3
		  AND role = 'admin' AND active = true
	`, hash, a.userID, a.orgID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return fmt.Errorf("administrator update did not affect exactly one row")
	}

	if err := db.AppendAudit(ctx, tx, a.orgID,
		"local-admin-recovery", "user.password_reset",
		"user", a.userID,
		map[string]string{"method": "local_cli"}); err != nil {
		return fmt.Errorf("audit recording failed: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}
	fmt.Println("Administrator password updated and audit entry recorded.")
	return nil
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "Admin recovery failed:", err)
		os.Exit(1)
	}
}

