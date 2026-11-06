package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const AccessLifetime = 15 * time.Minute
const RefreshLifetime = 7 * 24 * time.Hour
const PasswordCost = 12

type Claims struct {
	OrganizationID string `json:"org"`
	jwt.RegisteredClaims
}

func HashPassword(password string) (string, error) {
	if !utf8.ValidString(password) || utf8.RuneCountInString(password) < 14 || len(password) > 72 {
		return "", errors.New("password must be at least 14 characters and at most 72 UTF-8 bytes")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), PasswordCost)
	return string(hash), err
}

func ComparePassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func NewSecret(prefix string) (plain string, hash []byte, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return "", nil, err
	}
	plain = prefix + base64.RawURLEncoding.EncodeToString(b)
	sum := sha256.Sum256([]byte(plain))
	return plain, sum[:], nil
}

func HashSecret(plain string) []byte {
	sum := sha256.Sum256([]byte(plain))
	return sum[:]
}

func Sign(key []byte, org, user, session string, now time.Time) (string, error) {
	claims := Claims{OrganizationID: org, RegisteredClaims: jwt.RegisteredClaims{
		Issuer: "nexora-api", Subject: user, Audience: jwt.ClaimStrings{"nexora-api"},
		ID: session, IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(AccessLifetime)),
	}}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(key)
}

func Verify(key []byte, token string) (*Claims, error) {
	if len(token) > 4096 || token == "" {
		return nil, errors.New("invalid token")
	}
	claims := new(Claims)
	parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("invalid signing algorithm")
		}
		return key, nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer("nexora-api"), jwt.WithAudience("nexora-api"), jwt.WithExpirationRequired())
	if err != nil || !parsed.Valid {
		return nil, errors.New("invalid token")
	}
	for _, s := range []string{claims.Subject, claims.ID, claims.OrganizationID} {
		if _, err := uuid.Parse(s); err != nil {
			return nil, errors.New("invalid token")
		}
	}
	return claims, nil
}

func Bearer(header string) string {
	parts := strings.Fields(header)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return parts[1]
}

func Allowed(role, permission string) bool {
	if role == "admin" {
		return true
	}
	switch permission {
	case "read":
		return role == "analyst" || role == "responder" || role == "auditor" || role == "viewer"
	case "incident:write":
		return role == "analyst" || role == "responder"
	case "audit:read":
		return role == "auditor"
	default:
		return false
	}
}
