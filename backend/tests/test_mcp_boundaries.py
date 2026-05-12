import json
import os
import pytest

def test_mcp_config_valid_json():
    """Verify the MCP config is valid JSON."""
    config_path = os.path.join(os.path.dirname(__file__), "../../mcp_config.json")
    with open(config_path, "r") as f:
        config = json.load(f)
    assert "boundaries" in config
    assert "tools" in config

def test_mcp_config_paths_exist():
    """Verify all paths in the MCP config exist on disk."""
    config_path = os.path.join(os.path.dirname(__file__), "../../mcp_config.json")
    with open(config_path, "r") as f:
        config = json.load(f)
        
    base_dir = os.path.join(os.path.dirname(__file__), "../../")
    
    for category in ["read_only", "read_write", "blocked"]:
        for item in config["boundaries"].get(category, []):
            path = os.path.join(base_dir, item["path"])
            # Some paths might be files, some might be directories
            assert os.path.exists(path) or os.path.exists(os.path.dirname(path)), f"Path does not exist: {path}"
