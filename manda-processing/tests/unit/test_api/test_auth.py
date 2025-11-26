"""
Tests for API authentication dependencies.
Story: E3.1 - Set up FastAPI Backend with pg-boss Job Queue (AC: #5, #6)
"""

import hashlib
import hmac
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from src.api.dependencies import verify_api_key, verify_webhook_secret


class TestApiKeyAuthentication:
    """Tests for API key authentication middleware."""

    @pytest.fixture
    def app_with_protected_route(self, mock_settings: MagicMock) -> FastAPI:
        """Create an app with a protected route for testing."""
        from fastapi import Depends

        from src.api.dependencies import ApiKeyDep

        app = FastAPI()

        @app.get("/protected")
        async def protected_route(api_key: ApiKeyDep) -> dict[str, str]:
            return {"status": "authenticated", "api_key": api_key}

        return app

    def test_api_key_rejects_missing_key(
        self, app_with_protected_route: FastAPI, mock_settings: MagicMock
    ) -> None:
        """Test that missing API key is rejected."""
        client = TestClient(app_with_protected_route)

        response = client.get("/protected")

        assert response.status_code == 401
        assert "API key required" in response.json()["detail"]

    def test_api_key_rejects_invalid_key(
        self, app_with_protected_route: FastAPI, mock_settings: MagicMock
    ) -> None:
        """Test that invalid API key is rejected."""
        client = TestClient(app_with_protected_route)

        response = client.get("/protected", headers={"x-api-key": "invalid-key"})

        assert response.status_code == 401
        assert "Invalid API key" in response.json()["detail"]

    def test_api_key_accepts_valid_key(
        self, app_with_protected_route: FastAPI, mock_settings: MagicMock
    ) -> None:
        """Test that valid API key is accepted."""
        client = TestClient(app_with_protected_route)

        response = client.get(
            "/protected", headers={"x-api-key": mock_settings.api_key}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "authenticated"
        assert data["api_key"] == mock_settings.api_key


class TestWebhookSecretValidation:
    """Tests for webhook secret validation."""

    @pytest.fixture
    def app_with_webhook_route(self, mock_settings: MagicMock) -> FastAPI:
        """Create an app with a webhook route for testing."""
        from fastapi import Depends, Request

        app = FastAPI()

        @app.post("/webhook")
        async def webhook_route(
            request: Request,
            mock_settings: MagicMock = Depends(lambda: mock_settings),
        ) -> dict[str, str]:
            body = await request.body()

            # Compute expected signature
            signature = request.headers.get("x-supabase-signature")
            if not signature:
                raise HTTPException(status_code=401, detail="Signature required")

            expected = hmac.new(
                mock_settings.webhook_secret.encode(),
                body,
                hashlib.sha256,
            ).hexdigest()

            if not hmac.compare_digest(signature, expected):
                raise HTTPException(status_code=401, detail="Invalid signature")

            return {"status": "webhook_received"}

        return app

    def test_webhook_rejects_missing_signature(
        self, app_with_webhook_route: FastAPI, mock_settings: MagicMock
    ) -> None:
        """Test that missing webhook signature is rejected."""
        client = TestClient(app_with_webhook_route)

        response = client.post("/webhook", json={"event": "test"})

        assert response.status_code == 401

    def test_webhook_rejects_invalid_signature(
        self, app_with_webhook_route: FastAPI, mock_settings: MagicMock
    ) -> None:
        """Test that invalid webhook signature is rejected."""
        client = TestClient(app_with_webhook_route)

        response = client.post(
            "/webhook",
            json={"event": "test"},
            headers={"x-supabase-signature": "invalid-signature"},
        )

        assert response.status_code == 401

    def test_webhook_accepts_valid_signature(
        self, app_with_webhook_route: FastAPI, mock_settings: MagicMock
    ) -> None:
        """Test that valid webhook signature is accepted."""
        client = TestClient(app_with_webhook_route)

        body = b'{"event": "test"}'
        valid_signature = hmac.new(
            mock_settings.webhook_secret.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()

        response = client.post(
            "/webhook",
            content=body,
            headers={
                "x-supabase-signature": valid_signature,
                "content-type": "application/json",
            },
        )

        assert response.status_code == 200
        assert response.json()["status"] == "webhook_received"


class TestVerifyWebhookSecretDirect:
    """Direct tests for verify_webhook_secret function."""

    @pytest.mark.asyncio
    async def test_skips_validation_when_no_secret_configured(
        self, mock_settings: MagicMock
    ) -> None:
        """Test that validation is skipped when webhook_secret is empty."""
        mock_settings.webhook_secret = ""

        result = await verify_webhook_secret(
            x_supabase_signature=None,
            settings=mock_settings,
            body=b"test"
        )

        assert result is True

    @pytest.mark.asyncio
    async def test_raises_on_missing_signature_when_secret_configured(
        self, mock_settings: MagicMock
    ) -> None:
        """Test that HTTPException is raised when signature is missing."""
        mock_settings.webhook_secret = "test-secret"

        with pytest.raises(HTTPException) as exc_info:
            await verify_webhook_secret(
                x_supabase_signature=None,
                settings=mock_settings,
                body=b"test"
            )

        assert exc_info.value.status_code == 401
        assert "Webhook signature required" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_raises_on_invalid_signature(
        self, mock_settings: MagicMock
    ) -> None:
        """Test that HTTPException is raised for invalid signature."""
        mock_settings.webhook_secret = "test-secret"

        with pytest.raises(HTTPException) as exc_info:
            await verify_webhook_secret(
                x_supabase_signature="invalid-signature",
                settings=mock_settings,
                body=b"test"
            )

        assert exc_info.value.status_code == 401
        assert "Invalid webhook signature" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_accepts_valid_signature(
        self, mock_settings: MagicMock
    ) -> None:
        """Test that valid signature is accepted."""
        mock_settings.webhook_secret = "test-secret"
        body = b"test body"

        valid_signature = hmac.new(
            mock_settings.webhook_secret.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()

        result = await verify_webhook_secret(
            x_supabase_signature=valid_signature,
            settings=mock_settings,
            body=body
        )

        assert result is True
