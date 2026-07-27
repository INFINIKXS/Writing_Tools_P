import unittest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from main import app

class TestDepthBreadthRoute(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    @patch("analyzer.routes.gemini_request_with_retry", new_callable=AsyncMock)
    @patch("analyzer.routes.get_client")
    def test_analyze_depth_breadth_success(self, mock_get_client, mock_gemini_request):
        # Mock the client
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        # Mock the Gemini response
        mock_response = MagicMock()
        mock_response.text = """
        {
          "depth_score": 80,
          "breadth_score": 70,
          "sub_dimensions": {
            "thesis_strength": 85,
            "close_reading_evidence": 75,
            "lexical_depth": 90,
            "counter_argumentation": 70,
            "historical_contextualization": 65,
            "t_shaped_integration": 70,
            "demographic_lens_diversity": 70
          },
          "suggestions": {
            "thesis_strength": ["Add more specific variables to your thesis"],
            "close_reading_evidence": [],
            "lexical_depth": [],
            "counter_argumentation": ["Integrate a clearer turn back pivot"],
            "historical_contextualization": [],
            "t_shaped_integration": [],
            "demographic_lens_diversity": []
          }
        }
        """
        mock_gemini_request.return_value = mock_response

        # Call with text parameter
        response = self.client.post(
            "/api/analyze-depth-breadth",
            data={"text": "This is a sample academic writing text."}
        )

        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertEqual(json_data["depth_score"], 80)
        self.assertEqual(json_data["breadth_score"], 70)
        self.assertEqual(json_data["sub_dimensions"]["thesis_strength"], 85)
        self.assertEqual(json_data["suggestions"]["thesis_strength"][0], "Add more specific variables to your thesis")

    def test_analyze_depth_breadth_empty_input(self):
        # Call with no parameters
        response = self.client.post("/api/analyze-depth-breadth")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Please provide a writing draft", response.json()["detail"])

if __name__ == "__main__":
    unittest.main()
