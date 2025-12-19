"""
Unit tests for Neo4j client module.
Story: E4.15 - Sync Findings to Neo4j Knowledge Graph (AC: #1, #3, #4)

Tests use mocking to avoid requiring a running Neo4j instance.
Integration tests with actual Neo4j would be in tests/integration/
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone

from src.storage.neo4j_client import (
    get_neo4j_driver,
    close_neo4j_driver,
    create_finding_node,
    create_document_node,
    create_extracted_from_relationship,
    Neo4jConnectionError,
)


class TestNeo4jDriver:
    """Tests for Neo4j driver singleton."""

    @patch("src.storage.neo4j_client.GraphDatabase")
    @patch("src.storage.neo4j_client.get_settings")
    def test_get_neo4j_driver_creates_driver(self, mock_settings, mock_graphdb):
        """Test driver creation with valid settings."""
        # Setup mocks
        mock_settings.return_value.neo4j_uri = "bolt://localhost:7687"
        mock_settings.return_value.neo4j_user = "neo4j"
        mock_settings.return_value.neo4j_password = "password"

        mock_driver = MagicMock()
        mock_graphdb.driver.return_value = mock_driver

        # Get driver
        driver = get_neo4j_driver()

        # Verify driver was created
        assert driver is mock_driver
        mock_graphdb.driver.assert_called_once_with(
            "bolt://localhost:7687",
            auth=("neo4j", "password"),
            max_connection_pool_size=10,
        )
        mock_driver.verify_connectivity.assert_called_once()

    @patch("src.storage.neo4j_client.get_settings")
    def test_get_neo4j_driver_missing_uri(self, mock_settings):
        """Test driver creation fails with missing URI."""
        mock_settings.return_value.neo4j_uri = ""

        with pytest.raises(Neo4jConnectionError, match="NEO4J_URI"):
            get_neo4j_driver()

    @patch("src.storage.neo4j_client.get_settings")
    def test_get_neo4j_driver_missing_password(self, mock_settings):
        """Test driver creation fails with missing password."""
        mock_settings.return_value.neo4j_uri = "bolt://localhost:7687"
        mock_settings.return_value.neo4j_password = ""

        with pytest.raises(Neo4jConnectionError, match="NEO4J_PASSWORD"):
            get_neo4j_driver()


class TestCreateFindingNode:
    """Tests for creating Finding nodes."""

    @patch("src.storage.neo4j_client.get_neo4j_driver")
    def test_create_finding_node_success(self, mock_get_driver):
        """Test successful Finding node creation."""
        # Setup mock driver and session
        mock_driver = MagicMock()
        mock_session = MagicMock()
        mock_driver.session.return_value.__enter__.return_value = mock_session
        mock_get_driver.return_value = mock_driver

        # Create finding node
        create_finding_node(
            finding_id="finding-123",
            content="Revenue grew 50% YoY",
            finding_type="metric",
            confidence=0.95,
            domain="financial",
            date_referenced="2023-01-01",
            date_extracted=datetime.now(timezone.utc).isoformat(),
            user_id="user-456",
            project_id="project-789",
        )

        # Verify session.run was called with correct Cypher query
        mock_session.run.assert_called_once()
        call_args = mock_session.run.call_args

        # Check Cypher query contains MERGE
        assert "MERGE" in call_args[0][0]
        assert "(f:Finding {id: $id})" in call_args[0][0]

        # Check parameters
        params = call_args[1]
        assert params["id"] == "finding-123"
        assert params["content"] == "Revenue grew 50% YoY"
        assert params["type"] == "metric"
        assert params["confidence"] == 0.95
        assert params["domain"] == "financial"

    @patch("src.storage.neo4j_client.get_neo4j_driver")
    def test_create_finding_node_error_handling(self, mock_get_driver):
        """Test error handling when Finding node creation fails."""
        # Setup mock to raise exception
        mock_driver = MagicMock()
        mock_session = MagicMock()
        mock_session.run.side_effect = Exception("Connection lost")
        mock_driver.session.return_value.__enter__.return_value = mock_session
        mock_get_driver.return_value = mock_driver

        # Create finding node should raise Neo4jConnectionError
        with pytest.raises(Neo4jConnectionError, match="Failed to create Finding node"):
            create_finding_node(
                finding_id="finding-123",
                content="Test finding",
                finding_type="fact",
                confidence=0.8,
                domain="operational",
                date_referenced=None,
                date_extracted=datetime.now(timezone.utc).isoformat(),
                user_id="user-456",
                project_id="project-789",
            )


class TestCreateDocumentNode:
    """Tests for creating Document nodes."""

    @patch("src.storage.neo4j_client.get_neo4j_driver")
    def test_create_document_node_success(self, mock_get_driver):
        """Test successful Document node creation."""
        # Setup mock driver and session
        mock_driver = MagicMock()
        mock_session = MagicMock()
        mock_driver.session.return_value.__enter__.return_value = mock_session
        mock_get_driver.return_value = mock_driver

        # Create document node
        create_document_node(
            document_id="doc-123",
            name="financial_model.xlsx",
            project_id="project-789",
            upload_date="2024-01-01T00:00:00Z",
            doc_type="xlsx",
        )

        # Verify session.run was called with correct Cypher query
        mock_session.run.assert_called_once()
        call_args = mock_session.run.call_args

        # Check Cypher query contains MERGE
        assert "MERGE" in call_args[0][0]
        assert "(d:Document {id: $id})" in call_args[0][0]

        # Check parameters
        params = call_args[1]
        assert params["id"] == "doc-123"
        assert params["name"] == "financial_model.xlsx"
        assert params["project_id"] == "project-789"
        assert params["doc_type"] == "xlsx"


class TestCreateRelationship:
    """Tests for creating relationships."""

    @patch("src.storage.neo4j_client.get_neo4j_driver")
    def test_create_extracted_from_relationship_success(self, mock_get_driver):
        """Test successful EXTRACTED_FROM relationship creation."""
        # Setup mock driver and session
        mock_driver = MagicMock()
        mock_session = MagicMock()
        mock_driver.session.return_value.__enter__.return_value = mock_session
        mock_get_driver.return_value = mock_driver

        # Create relationship
        create_extracted_from_relationship(
            finding_id="finding-123",
            document_id="doc-456",
        )

        # Verify session.run was called with correct Cypher query
        mock_session.run.assert_called_once()
        call_args = mock_session.run.call_args

        # Check Cypher query contains MATCH and MERGE
        assert "MATCH (f:Finding {id: $finding_id})" in call_args[0][0]
        assert "MATCH (d:Document {id: $document_id})" in call_args[0][0]
        assert "MERGE (f)-[:EXTRACTED_FROM]->(d)" in call_args[0][0]

        # Check parameters
        params = call_args[1]
        assert params["finding_id"] == "finding-123"
        assert params["document_id"] == "doc-456"
