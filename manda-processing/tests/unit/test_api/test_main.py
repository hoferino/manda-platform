"""
Tests for FastAPI application setup.
Story: E3.1 - Set up FastAPI Backend with pg-boss Job Queue (AC: #1, #6)
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from src.main import create_app, lifespan


class TestCreateApp:
    """Tests for create_app function."""

    def test_create_app_returns_fastapi_instance(self) -> None:
        """Test that create_app returns a FastAPI instance."""
        from fastapi import FastAPI

        app = create_app()

        assert isinstance(app, FastAPI)
        assert app.title == "Manda Processing Service"
        assert app.version == "0.1.0"

    def test_create_app_includes_health_routes(self) -> None:
        """Test that create_app includes health routes."""
        app = create_app()
        client = TestClient(app)

        # Health route should be registered
        response = client.get("/health")
        assert response.status_code == 200

    def test_create_app_development_mode_has_docs(
        self, mock_settings: MagicMock
    ) -> None:
        """Test that development mode enables docs."""
        mock_settings.is_development = True

        app = create_app()

        assert app.docs_url == "/docs"
        assert app.redoc_url == "/redoc"

    def test_create_app_production_mode_disables_docs(self) -> None:
        """Test that production mode disables docs."""
        with patch("src.main.get_settings") as mock_get_settings:
            mock_settings = MagicMock()
            mock_settings.is_development = False
            mock_settings.app_env = "production"
            mock_settings.debug = False
            mock_settings.log_format = "json"
            mock_get_settings.return_value = mock_settings

            app = create_app()

            assert app.docs_url is None
            assert app.redoc_url is None

    def test_create_app_development_mode_adds_cors(
        self, mock_settings: MagicMock
    ) -> None:
        """Test that development mode adds CORS middleware."""
        mock_settings.is_development = True

        app = create_app()

        # Check that CORS middleware is present
        middleware_classes = [m.cls.__name__ for m in app.user_middleware]
        assert "CORSMiddleware" in middleware_classes


class TestLifespan:
    """Tests for application lifespan."""

    @pytest.mark.asyncio
    async def test_lifespan_logs_startup_and_shutdown(
        self, mock_settings: MagicMock
    ) -> None:
        """Test that lifespan logs startup and shutdown."""
        from fastapi import FastAPI

        app = FastAPI()

        with patch("src.main.logger") as mock_logger:
            async with lifespan(app):
                # Verify startup was logged
                mock_logger.info.assert_called()
                startup_call = mock_logger.info.call_args_list[0]
                assert "Starting" in startup_call[0][0]

            # Verify shutdown was logged
            shutdown_calls = [
                call for call in mock_logger.info.call_args_list
                if "Shutting down" in str(call)
            ]
            assert len(shutdown_calls) >= 1


class TestAppInstance:
    """Tests for the app instance."""

    def test_app_is_fastapi_instance(self) -> None:
        """Test that the app module exposes a FastAPI instance."""
        from src.main import app
        from fastapi import FastAPI

        assert isinstance(app, FastAPI)

    def test_app_responds_to_health_check(self) -> None:
        """Test that the app responds to health checks."""
        from src.main import app

        client = TestClient(app)
        response = client.get("/health")

        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
