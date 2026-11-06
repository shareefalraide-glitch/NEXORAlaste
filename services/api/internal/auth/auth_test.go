package auth

import (
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func TestPasswordsSecretsAndTokens(t *testing.T) {
	password := "strong-test-password-for-example"
	hash, err := HashPassword(password)
	if err != nil || hash == password || !ComparePassword(hash, password) || ComparePassword(hash, "incorrect-password") {
		t.Fatal("password hashing/verification failed")
	}
	for _, p := range []string{"short", strings.Repeat("a", 73)} {
		if _, err := HashPassword(p); err == nil {
			t.Fatal("invalid password accepted")
		}
	}
	a, ah, err := NewSecret("rfr_")
	if err != nil {
		t.Fatal(err)
	}
	b, bh, err := NewSecret("rfr_")
	if err != nil || a == b || string(ah) == string(bh) || string(ah) != string(HashSecret(a)) {
		t.Fatal("secret generation/hashing failed")
	}
	key := []byte("test-key-never-use-in-production-123456789")
	org, user, session := uuid.NewString(), uuid.NewString(), uuid.NewString()
	token, err := Sign(key, org, user, session, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	claims, err := Verify(key, token)
	if err != nil || claims.Subject != user || claims.OrganizationID != org || claims.ID != session {
		t.Fatal("valid token rejected")
	}
	if _, err = Verify([]byte("different-secret"), token); err == nil {
		t.Fatal("wrong signing key accepted")
	}
	expired, _ := Sign(key, org, user, session, time.Now().Add(-time.Hour))
	if _, err = Verify(key, expired); err == nil {
		t.Fatal("expired token accepted")
	}
	unsecured := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{"sub": user, "org": org, "jti": session, "iss": "nexora-api", "aud": "nexora-api", "exp": time.Now().Add(time.Hour).Unix()})
	unsigned, _ := unsecured.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if _, err = Verify(key, unsigned); err == nil {
		t.Fatal("unsigned token accepted")
	}
}

func TestAuthorization(t *testing.T) {
	if Allowed("viewer", "incident:write") || Allowed("analyst", "audit:read") || Allowed("viewer", "admin") || !Allowed("auditor", "audit:read") || !Allowed("admin", "admin") {
		t.Fatal("role authorization mismatch")
	}
}
