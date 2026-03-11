"""
test_api.py — FastAPI Endpoint Smoke Tests
"""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    import os, sys
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pipelines_dir = os.path.join(backend_dir, "pipelines")
    sys.path.insert(0, pipelines_dir)
    sys.path.insert(0, backend_dir)
    os.chdir(pipelines_dir)
    from main import app
    return TestClient(app, raise_server_exceptions=False)


class TestAPIEndpoints:
    def test_root(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_momentum_data(self, client):
        assert client.get("/momentum_data.json").status_code in (200, 202)

    def test_pipeline_status(self, client):
        resp = client.get("/api/pipeline/status")
        assert resp.status_code == 200
        assert resp.json()["state"] in ("idle", "running", "done", "error")

    def test_indicators(self, client):
        resp = client.get("/api/indicators")
        assert resp.status_code == 200
        assert "indicators" in resp.json()

    def test_strategy_list(self, client):
        assert "strategies" in client.get("/api/strategy/list").json()

    def test_backtest_history(self, client):
        assert "history" in client.get("/api/backtest/history").json()

    def test_backtest_cancel(self, client):
        assert client.post("/api/backtest/cancel").status_code == 200

    def test_receipts(self, client):
        assert client.get("/api/receipts").status_code == 200

    def test_ticker_search_empty(self, client):
        resp = client.get("/api/ticker/search?q=")
        assert resp.json()["results"] == []


class TestAPIRoutes:
    def test_all_routes_exist(self, client):
        routes = [r.path for r in client.app.routes]
        for path in ["/", "/momentum_data.json", "/api/screen",
                     "/api/pipeline/status", "/api/data/status", "/api/data/sync",
                     "/api/backtest", "/api/backtest/cancel", "/api/backtest/history",
                     "/api/compare", "/api/indicators", "/api/strategy/backtest",
                     "/api/strategy/code", "/api/strategy/save", "/api/strategy/list",
                     "/api/ticker/search", "/api/ticker/add", "/api/receipts"]:
            assert path in routes, f"Route {path} not registered"
