#!/usr/bin/env python3
"""
Stripe Payment Integration Backend API Testing - CORRECTED VERSION
Tests all Stripe payment endpoints as specified in the review request.
"""

import requests
import json
import sys
from datetime import datetime

# API Configuration
BASE_URL = "https://point-vault.preview.emergentagent.com/api"

# Test Credentials
USER_EMAIL = "mobile@test.com"
USER_PASSWORD = "test1234"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        
    def log_pass(self, test_name):
        print(f"✅ PASS: {test_name}")
        self.passed += 1
        
    def log_fail(self, test_name, error):
        print(f"❌ FAIL: {test_name} - {error}")
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"STRIPE API TEST SUMMARY: {self.passed}/{total} passed")
        if self.errors:
            print(f"\nFAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        print(f"{'='*60}")
        return self.failed == 0

def make_request(method, endpoint, headers=None, data=None):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=60)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=60)
        else:
            raise ValueError(f"Unsupported method: {method}")
            
        return response
    except requests.exceptions.RequestException as e:
        print(f"Network error for {method} {url}: {e}")
        # Return a mock response object for network errors
        class MockResponse:
            def __init__(self):
                self.status_code = 0
                self.text = f"Network error: {e}"
        return MockResponse()

def test_user_login(results):
    """Test user login and get token for authenticated endpoints"""
    print("\n🔐 Testing User Login...")
    
    response = make_request("POST", "/auth/login", data={
        "email": USER_EMAIL,
        "password": USER_PASSWORD
    })
    
    if not response or response.status_code == 0:
        results.log_fail("User Login", "Network error")
        return None
        
    if response.status_code == 200:
        data = response.json()
        if "token" in data:
            results.log_pass("User Login")
            print(f"   Logged in as: {USER_EMAIL}")
            return data["token"]
        else:
            results.log_fail("User Login", "No token in response")
            return None
    else:
        results.log_fail("User Login", f"Status {response.status_code}: {response.text}")
        return None

def test_stripe_packages(results):
    """Test GET /api/stripe/packages - Should return 4 packages with MYR prices"""
    print("\n📦 Testing GET /api/stripe/packages...")
    
    response = make_request("GET", "/stripe/packages")
    
    if not response or response.status_code == 0:
        results.log_fail("GET Stripe Packages", "Network error")
        return False
        
    if response.status_code == 200:
        data = response.json()
        
        if "packages" not in data:
            results.log_fail("GET Stripe Packages", "No 'packages' field in response")
            return False
            
        packages = data["packages"]
        
        # Should have exactly 4 packages
        if len(packages) != 4:
            results.log_fail("GET Stripe Packages", f"Expected 4 packages, got {len(packages)}")
            return False
        
        # Check for required package IDs
        expected_packages = ["starter", "value", "premium", "elite"]
        package_ids = [pkg.get("id") for pkg in packages]
        
        for expected_id in expected_packages:
            if expected_id not in package_ids:
                results.log_fail("GET Stripe Packages", f"Missing package: {expected_id}")
                return False
        
        # Check package structure and MYR currency
        for pkg in packages:
            required_fields = ["id", "points", "amount", "currency", "label"]
            for field in required_fields:
                if field not in pkg:
                    results.log_fail("GET Stripe Packages", f"Package {pkg.get('id')} missing field: {field}")
                    return False
            
            if pkg["currency"] != "myr":
                results.log_fail("GET Stripe Packages", f"Package {pkg['id']} has wrong currency: {pkg['currency']}")
                return False
        
        results.log_pass("GET Stripe Packages")
        print(f"   Found {len(packages)} packages with MYR currency:")
        for pkg in packages:
            print(f"     - {pkg['id']}: {pkg['points']} points for RM{pkg['amount']}")
        
        return True
        
    else:
        results.log_fail("GET Stripe Packages", f"Status {response.status_code}: {response.text}")
        return False

def test_stripe_config(results):
    """Test GET /api/stripe/config - Should return publishable key"""
    print("\n🔑 Testing GET /api/stripe/config...")
    
    response = make_request("GET", "/stripe/config")
    
    if not response or response.status_code == 0:
        results.log_fail("GET Stripe Config", "Network error")
        return False
        
    if response.status_code == 200:
        data = response.json()
        
        if "publishable_key" not in data:
            results.log_fail("GET Stripe Config", "No 'publishable_key' field in response")
            return False
        
        publishable_key = data["publishable_key"]
        
        # Check if it's a valid Stripe publishable key format
        if not publishable_key.startswith("pk_"):
            results.log_fail("GET Stripe Config", f"Invalid publishable key format: {publishable_key}")
            return False
        
        results.log_pass("GET Stripe Config")
        print(f"   Publishable key: {publishable_key[:20]}...")
        
        return True
        
    else:
        results.log_fail("GET Stripe Config", f"Status {response.status_code}: {response.text}")
        return False

def test_stripe_checkout(results, user_token):
    """Test POST /api/stripe/checkout - Create checkout session"""
    print("\n💳 Testing POST /api/stripe/checkout...")
    
    headers = {"Authorization": f"Bearer {user_token}"}
    checkout_data = {
        "package_id": "starter",
        "origin_url": "https://example.com"
    }
    
    response = make_request("POST", "/stripe/checkout", headers=headers, data=checkout_data)
    
    if not response or response.status_code == 0:
        results.log_fail("POST Stripe Checkout", "Network error")
        return None
        
    if response.status_code == 200:
        data = response.json()
        
        required_fields = ["url", "session_id"]
        for field in required_fields:
            if field not in data:
                results.log_fail("POST Stripe Checkout", f"Missing field: {field}")
                return None
        
        # Check if URL is a valid Stripe checkout URL
        if not data["url"].startswith("https://checkout.stripe.com"):
            results.log_fail("POST Stripe Checkout", f"Invalid checkout URL: {data['url']}")
            return None
        
        # Check session_id format
        if not data["session_id"].startswith("cs_"):
            results.log_fail("POST Stripe Checkout", f"Invalid session_id format: {data['session_id']}")
            return None
        
        results.log_pass("POST Stripe Checkout")
        print(f"   Checkout URL: {data['url'][:50]}...")
        print(f"   Session ID: {data['session_id']}")
        
        return data["session_id"]
        
    else:
        results.log_fail("POST Stripe Checkout", f"Status {response.status_code}: {response.text}")
        return None

def test_stripe_checkout_invalid_package(results, user_token):
    """Test POST /api/stripe/checkout with invalid package_id"""
    print("\n🚫 Testing POST /api/stripe/checkout (Invalid Package)...")
    
    headers = {"Authorization": f"Bearer {user_token}"}
    checkout_data = {
        "package_id": "invalid_package",
        "origin_url": "https://example.com"
    }
    
    response = make_request("POST", "/stripe/checkout", headers=headers, data=checkout_data)
    
    if not response or response.status_code == 0:
        results.log_fail("POST Stripe Checkout (Invalid)", "Network error")
        return False
        
    if response.status_code == 400:
        data = response.json()
        if "Invalid package" in data.get("detail", ""):
            results.log_pass("POST Stripe Checkout (Invalid)")
            print(f"   Correctly rejected invalid package: {data.get('detail')}")
            return True
        else:
            results.log_fail("POST Stripe Checkout (Invalid)", f"Wrong error message: {data.get('detail')}")
            return False
    else:
        results.log_fail("POST Stripe Checkout (Invalid)", f"Expected 400, got {response.status_code}: {response.text}")
        return False

def test_stripe_checkout_unauthorized(results):
    """Test POST /api/stripe/checkout without authentication"""
    print("\n🔒 Testing POST /api/stripe/checkout (Unauthorized)...")
    
    checkout_data = {
        "package_id": "starter",
        "origin_url": "https://example.com"
    }
    
    response = make_request("POST", "/stripe/checkout", data=checkout_data)
    
    if not response or response.status_code == 0:
        results.log_fail("POST Stripe Checkout (Unauthorized)", "Network error")
        return False
        
    if response.status_code in [401, 403]:
        results.log_pass("POST Stripe Checkout (Unauthorized)")
        print(f"   Correctly rejected unauthorized request with status {response.status_code}")
        return True
    else:
        results.log_fail("POST Stripe Checkout (Unauthorized)", f"Expected 401/403, got {response.status_code}: {response.text}")
        return False

def test_stripe_cards(results, user_token):
    """Test GET /api/stripe/cards - Should return empty cards array for new user"""
    print("\n💳 Testing GET /api/stripe/cards...")
    
    headers = {"Authorization": f"Bearer {user_token}"}
    
    response = make_request("GET", "/stripe/cards", headers=headers)
    
    if not response or response.status_code == 0:
        results.log_fail("GET Stripe Cards", "Network error")
        return False
        
    if response.status_code == 200:
        data = response.json()
        
        if "cards" not in data:
            results.log_fail("GET Stripe Cards", "No 'cards' field in response")
            return False
        
        cards = data["cards"]
        
        # Should be an array (empty for new user)
        if not isinstance(cards, list):
            results.log_fail("GET Stripe Cards", f"Cards should be an array, got {type(cards)}")
            return False
        
        results.log_pass("GET Stripe Cards")
        print(f"   Found {len(cards)} saved cards")
        
        return True
        
    else:
        results.log_fail("GET Stripe Cards", f"Status {response.status_code}: {response.text}")
        return False

def test_stripe_cards_unauthorized(results):
    """Test GET /api/stripe/cards without authentication"""
    print("\n🔒 Testing GET /api/stripe/cards (Unauthorized)...")
    
    response = make_request("GET", "/stripe/cards")
    
    if not response or response.status_code == 0:
        results.log_fail("GET Stripe Cards (Unauthorized)", "Network error")
        return False
        
    if response.status_code in [401, 403]:
        results.log_pass("GET Stripe Cards (Unauthorized)")
        print(f"   Correctly rejected unauthorized request with status {response.status_code}")
        return True
    else:
        results.log_fail("GET Stripe Cards (Unauthorized)", f"Expected 401/403, got {response.status_code}: {response.text}")
        return False

def test_stripe_setup_intent(results, user_token):
    """Test POST /api/stripe/setup-intent - Should return client_secret and setup_intent_id"""
    print("\n🔧 Testing POST /api/stripe/setup-intent...")
    
    headers = {"Authorization": f"Bearer {user_token}"}
    
    response = make_request("POST", "/stripe/setup-intent", headers=headers)
    
    if not response or response.status_code == 0:
        results.log_fail("POST Stripe Setup Intent", "Network error")
        return False
        
    if response.status_code == 200:
        data = response.json()
        
        required_fields = ["client_secret", "setup_intent_id"]
        for field in required_fields:
            if field not in data:
                results.log_fail("POST Stripe Setup Intent", f"Missing field: {field}")
                return False
        
        # Check client_secret format
        if not data["client_secret"].startswith("seti_"):
            results.log_fail("POST Stripe Setup Intent", f"Invalid client_secret format: {data['client_secret']}")
            return False
        
        # Check setup_intent_id format
        if not data["setup_intent_id"].startswith("seti_"):
            results.log_fail("POST Stripe Setup Intent", f"Invalid setup_intent_id format: {data['setup_intent_id']}")
            return False
        
        results.log_pass("POST Stripe Setup Intent")
        print(f"   Setup Intent ID: {data['setup_intent_id']}")
        print(f"   Client Secret: {data['client_secret'][:20]}...")
        
        return True
        
    else:
        results.log_fail("POST Stripe Setup Intent", f"Status {response.status_code}: {response.text}")
        return False

def test_stripe_setup_intent_unauthorized(results):
    """Test POST /api/stripe/setup-intent without authentication"""
    print("\n🔒 Testing POST /api/stripe/setup-intent (Unauthorized)...")
    
    response = make_request("POST", "/stripe/setup-intent")
    
    if not response or response.status_code == 0:
        results.log_fail("POST Stripe Setup Intent (Unauthorized)", "Network error")
        return False
        
    if response.status_code in [401, 403]:
        results.log_pass("POST Stripe Setup Intent (Unauthorized)")
        print(f"   Correctly rejected unauthorized request with status {response.status_code}")
        return True
    else:
        results.log_fail("POST Stripe Setup Intent (Unauthorized)", f"Expected 401/403, got {response.status_code}: {response.text}")
        return False

def test_stripe_transactions(results, user_token):
    """Test GET /api/stripe/transactions - Should return transactions array"""
    print("\n📊 Testing GET /api/stripe/transactions...")
    
    headers = {"Authorization": f"Bearer {user_token}"}
    
    response = make_request("GET", "/stripe/transactions", headers=headers)
    
    if not response or response.status_code == 0:
        results.log_fail("GET Stripe Transactions", "Network error")
        return False
        
    if response.status_code == 200:
        data = response.json()
        
        if "transactions" not in data:
            results.log_fail("GET Stripe Transactions", "No 'transactions' field in response")
            return False
        
        transactions = data["transactions"]
        
        # Should be an array
        if not isinstance(transactions, list):
            results.log_fail("GET Stripe Transactions", f"Transactions should be an array, got {type(transactions)}")
            return False
        
        results.log_pass("GET Stripe Transactions")
        print(f"   Found {len(transactions)} payment transactions")
        
        # If there are transactions, check their structure
        if transactions:
            first_txn = transactions[0]
            expected_fields = ["id", "user_email", "package_id", "points", "amount", "currency", "payment_status", "status", "created_at"]
            for field in expected_fields:
                if field not in first_txn:
                    print(f"   Warning: Transaction missing field: {field}")
        
        return True
        
    else:
        results.log_fail("GET Stripe Transactions", f"Status {response.status_code}: {response.text}")
        return False

def test_stripe_transactions_unauthorized(results):
    """Test GET /api/stripe/transactions without authentication"""
    print("\n🔒 Testing GET /api/stripe/transactions (Unauthorized)...")
    
    response = make_request("GET", "/stripe/transactions")
    
    if not response or response.status_code == 0:
        results.log_fail("GET Stripe Transactions (Unauthorized)", "Network error")
        return False
        
    if response.status_code in [401, 403]:
        results.log_pass("GET Stripe Transactions (Unauthorized)")
        print(f"   Correctly rejected unauthorized request with status {response.status_code}")
        return True
    else:
        results.log_fail("GET Stripe Transactions (Unauthorized)", f"Expected 401/403, got {response.status_code}: {response.text}")
        return False

def main():
    """Main test execution"""
    print("🚀 Starting Stripe Payment Integration API Tests")
    print(f"Testing against: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    results = TestResults()
    
    # Step 1: Test public endpoints (no auth required)
    print("\n" + "="*60)
    print("TESTING PUBLIC ENDPOINTS")
    print("="*60)
    
    test_stripe_packages(results)
    test_stripe_config(results)
    
    # Step 2: Test unauthorized access to protected endpoints
    print("\n" + "="*60)
    print("TESTING UNAUTHORIZED ACCESS")
    print("="*60)
    
    test_stripe_checkout_unauthorized(results)
    test_stripe_cards_unauthorized(results)
    test_stripe_setup_intent_unauthorized(results)
    test_stripe_transactions_unauthorized(results)
    
    # Step 3: Login to get auth token
    print("\n" + "="*60)
    print("AUTHENTICATION")
    print("="*60)
    
    user_token = test_user_login(results)
    if not user_token:
        print("❌ Cannot proceed without user token")
        results.summary()
        return False
    
    # Step 4: Test authenticated endpoints
    print("\n" + "="*60)
    print("TESTING AUTHENTICATED ENDPOINTS")
    print("="*60)
    
    # Test checkout endpoint
    session_id = test_stripe_checkout(results, user_token)
    test_stripe_checkout_invalid_package(results, user_token)
    
    # Test cards endpoint
    test_stripe_cards(results, user_token)
    
    # Test setup intent endpoint
    test_stripe_setup_intent(results, user_token)
    
    # Test transactions endpoint
    test_stripe_transactions(results, user_token)
    
    # Final summary
    success = results.summary()
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)