#!/usr/bin/env python3
"""
Debug Stripe API endpoints to understand failures
"""

import requests
import json

BASE_URL = "https://point-vault.preview.emergentagent.com/api"
USER_EMAIL = "mobile@test.com"
USER_PASSWORD = "test1234"

def debug_request(method, endpoint, headers=None, data=None):
    """Make HTTP request with detailed debugging"""
    url = f"{BASE_URL}{endpoint}"
    print(f"\n🔍 DEBUG: {method} {url}")
    if headers:
        print(f"   Headers: {headers}")
    if data:
        print(f"   Data: {data}")
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=60)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=60)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text[:200]}...")
        return response
    except Exception as e:
        print(f"   ERROR: {e}")
        return None

def main():
    print("🔍 Debugging Stripe API failures...")
    
    # Test unauthorized access
    print("\n" + "="*50)
    print("TESTING UNAUTHORIZED ACCESS")
    print("="*50)
    
    debug_request("POST", "/stripe/checkout", data={"package_id": "starter", "origin_url": "https://example.com"})
    debug_request("GET", "/stripe/cards")
    debug_request("POST", "/stripe/setup-intent")
    debug_request("GET", "/stripe/transactions")
    
    # Get auth token
    print("\n" + "="*50)
    print("GETTING AUTH TOKEN")
    print("="*50)
    
    login_response = debug_request("POST", "/auth/login", data={"email": USER_EMAIL, "password": USER_PASSWORD})
    if login_response and login_response.status_code == 200:
        token = login_response.json().get("token")
        print(f"   Token: {token[:20]}...")
        
        # Test invalid package with auth
        print("\n" + "="*50)
        print("TESTING INVALID PACKAGE WITH AUTH")
        print("="*50)
        
        headers = {"Authorization": f"Bearer {token}"}
        debug_request("POST", "/stripe/checkout", headers=headers, data={"package_id": "invalid_package", "origin_url": "https://example.com"})
    else:
        print("   Failed to get auth token")

if __name__ == "__main__":
    main()