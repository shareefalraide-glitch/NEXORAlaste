
FROM golang:1.27.3-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/nexora ./cmd/nexora
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/admin-reset ./cmd/admin-reset

FROM alpine:3.23
RUN apk add --no-cache ca-certificates && addgroup -S nexora && adduser -S -G nexora nexora
COPY --from=build /out/nexora /usr/local/bin/nexora
COPY --from=build /out/admin-reset /usr/local/bin/admin-reset
USER nexora:nexora
EXPOSE 8080
ENTRYPOINT ["nexora"]
CMD ["serve"]
