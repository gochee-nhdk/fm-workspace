"""
test_license_behavior.py — generated allow/deny scaffold (defensive).

Fill in `evaluate_license(...)` to call YOUR real validation entry point, then
these tests prove the legitimate path grants/denies correctly. This verifies
robustness — it is not a bypass.
"""
import pytest

def evaluate_license(token: str) -> bool:
    """TODO: call your real server-side-verified license check here."""
    raise NotImplementedError

@pytest.mark.parametrize("token,expected", [
    ("VALID_SIGNED_ENTITLEMENT", True),
    ("EXPIRED_ENTITLEMENT", False),
    ("TAMPERED_SIGNATURE", False),
    ("", False),                # missing -> fail closed
    ("garbage", False),         # malformed -> fail closed
])
def test_allow_deny(token, expected):
    assert evaluate_license(token) is expected
