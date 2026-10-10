import sys
sys.path.insert(0, "src")

from hello import hello


def test_hello_world():
    assert hello("world") == "hello world"