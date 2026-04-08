#!/usr/bin/env python3
"""
Backend API Testing for Purchase QR Code Generation and Claim Flow
Tests the specific endpoints: /vendor/generate-purchase-qr and /claim-purchase
"""

import requests
import json
import sys
from datetime import datetime

# API Configuration
BASE_URL = "https://point-vault.preview.emergentagent.com/api"

# Test Credentials
VENDOR_EMAIL = "pakali@vendor.my"
VENDOR_PASSWORD = "vendor123"
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
        print(f"TEST SUMMARY: {self.passed}/{total} passed")
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
            response = requests.get(url, headers=headers, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=30)
        elif method.upper() == "PUT":
            response = requests.put(url, headers=headers, json=data, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
            
        return response
    except requests.exceptions.RequestException as e:
        print(f"Request failed for {method} {url}: {e}")
        return None

def test_vendor_login(results):
    """Test vendor login and get token"""
    print("\n🔐 Testing Vendor Login...")
    
    response = make_request("POST", "/vendor/login", data={
        "email": VENDOR_EMAIL,
        "password": VENDOR_PASSWORD
    })
    
    if not response:
        results.log_fail("Vendor Login", "Request failed")
        return None
        
    if response.status_code == 200:
        data = response.json()
        if "token" in data:
            results.log_pass("Vendor Login")
            return data["token"]
        else:
            results.log_fail("Vendor Login", "No token in response")
            return None
    else:
        results.log_fail("Vendor Login", f"Status {response.status_code}: {response.text}")
        return None

def test_user_login(results):
    """Test user login and get token"""
    print("\n🔐 Testing User Login...")
    
    response = make_request("POST", "/auth/login", data={
        "email": USER_EMAIL,
        "password": USER_PASSWORD
    })
    
    if not response:
        results.log_fail("User Login", "Request failed")
        return None
        
    if response.status_code == 200:
        data = response.json()
        if "token" in data:
            results.log_pass("User Login")
            return data["token"]
        else:
            results.log_fail("User Login", "No token in response")
            return None
    else:
        results.log_fail("User Login", f"Status {response.status_code}: {response.text}")
        return None

def test_vendor_point_rules(results, vendor_token):
    """Test vendor point rules endpoint"""
    print("\n📊 Testing Vendor Point Rules...")
    
    headers = {"Authorization": f"Bearer {vendor_token}"}
    response = make_request("GET", "/vendor/point-rules", headers=headers)
    
    if not response:
        results.log_fail("Get Point Rules", "Request failed")
        return False
        
    if response.status_code == 200:
        data = response.json()
        if "rules" in data:
            rules = data["rules"]
            if len(rules) > 0:
                results.log_pass("Get Point Rules - Has rules")
                print(f"   Found {len(rules)} point rules")
                for rule in rules:
                    print(f"   - {rule.get('label', 'Unnamed')}: RM{rule.get('min_amount', 0)}-{rule.get('max_amount', '∞')} = {rule.get('points_reward', 0)} pts")
                return True
            else:
                # Create default point rules for testing
                print("   No point rules found, creating default Bronze/Silver/Gold tiers...")
                return create_default_point_rules(results, vendor_token)
        else:
            results.log_fail("Get Point Rules", "No 'rules' field in response")
            return False
    else:
        results.log_fail("Get Point Rules", f"Status {response.status_code}: {response.text}")
        return False

def create_default_point_rules(results, vendor_token):
    """Create default point rules for testing"""
    headers = {"Authorization": f"Bearer {vendor_token}"}
    
    rules_to_create = [
        {"min_amount": 0, "max_amount": 50, "points_reward": 10, "label": "Bronze Tier"},
        {"min_amount": 50, "max_amount": 100, "points_reward": 20, "label": "Silver Tier"},
        {"min_amount": 100, "max_amount": -1, "points_reward": 35, "label": "Gold Tier"}
    ]
    
    for rule_data in rules_to_create:
        response = make_request("POST", "/vendor/point-rules", headers=headers, data=rule_data)
        if response and response.status_code == 200:
            print(f"   Created {rule_data['label']}")
        else:
            results.log_fail("Create Point Rules", f"Failed to create {rule_data['label']}")
            return False
    
    results.log_pass("Create Default Point Rules")
    return True

def test_generate_purchase_qr(results, vendor_token):
    """Test purchase QR generation"""
    print("\n🎫 Testing Purchase QR Generation...")
    
    headers = {"Authorization": f"Bearer {vendor_token}"}
    
    # Test with RM75 (should match Silver tier: 20 points)
    test_data = {
        "bill_amount": 75.0,
        "description": "Test purchase for QR generation"
    }
    
    response = make_request("POST", "/vendor/generate-purchase-qr", headers=headers, data=test_data)
    
    if not response:
        results.log_fail("Generate Purchase QR", "Request failed")
        return None
        
    if response.status_code == 200:
        data = response.json()
        required_fields = ["purchase", "qr_code", "qr_data"]
        
        for field in required_fields:
            if field not in data:
                results.log_fail("Generate Purchase QR", f"Missing field: {field}")
                return None
        
        purchase = data["purchase"]
        qr_data = data["qr_data"]
        
        # Validate purchase data
        if not purchase.get("code", "").startswith("PUR-"):
            results.log_fail("Generate Purchase QR", "Invalid purchase code format")
            return None
            
        if purchase.get("bill_amount") != 75.0:
            results.log_fail("Generate Purchase QR", f"Wrong bill amount: {purchase.get('bill_amount')}")
            return None
            
        if purchase.get("points_reward") != 20:
            results.log_fail("Generate Purchase QR", f"Wrong points reward: {purchase.get('points_reward')} (expected 20 for Silver tier)")
            return None
            
        if not qr_data.startswith("PURCHASE:"):
            results.log_fail("Generate Purchase QR", "Invalid QR data format")
            return None
            
        results.log_pass("Generate Purchase QR")
        print(f"   Generated code: {purchase['code']}")
        print(f"   Bill amount: RM{purchase['bill_amount']}")
        print(f"   Points reward: {purchase['points_reward']}")
        print(f"   QR data: {qr_data}")
        
        return qr_data
        
    else:
        results.log_fail("Generate Purchase QR", f"Status {response.status_code}: {response.text}")
        return None

def test_claim_purchase_success(results, user_token, qr_data):
    """Test successful purchase claim"""
    print("\n🎯 Testing Purchase Claim (Success)...")
    
    headers = {"Authorization": f"Bearer {user_token}"}
    
    response = make_request("POST", "/claim-purchase", headers=headers, data={"qr_data": qr_data})
    
    if not response:
        results.log_fail("Claim Purchase (Success)", "Request failed")
        return False
        
    if response.status_code == 200:
        data = response.json()
        required_fields = ["points_earned", "vendor_name", "bill_amount", "new_balance"]
        
        for field in required_fields:
            if field not in data:
                results.log_fail("Claim Purchase (Success)", f"Missing field: {field}")
                return False
        
        if data["points_earned"] != 20:
            results.log_fail("Claim Purchase (Success)", f"Wrong points earned: {data['points_earned']}")
            return False
            
        if data["bill_amount"] != 75.0:
            results.log_fail("Claim Purchase (Success)", f"Wrong bill amount: {data['bill_amount']}")
            return False
            
        results.log_pass("Claim Purchase (Success)")
        print(f"   Points earned: {data['points_earned']}")
        print(f"   Vendor: {data['vendor_name']}")
        print(f"   Bill amount: RM{data['bill_amount']}")
        print(f"   New balance: {data['new_balance']}")
        
        return True
        
    else:
        results.log_fail("Claim Purchase (Success)", f"Status {response.status_code}: {response.text}")
        return False

def test_claim_purchase_duplicate(results, user_token, qr_data):
    """Test duplicate purchase claim (should fail)"""
    print("\n🚫 Testing Purchase Claim (Duplicate)...")
    
    headers = {"Authorization": f"Bearer {user_token}"}
    
    response = make_request("POST", "/claim-purchase", headers=headers, data={"qr_data": qr_data})
    
    if not response:
        results.log_fail("Claim Purchase (Duplicate)", "Request failed")
        return False
        
    if response.status_code == 400:
        data = response.json()
        if "already been claimed" in data.get("detail", "").lower():
            results.log_pass("Claim Purchase (Duplicate)")
            print(f"   Correctly rejected: {data.get('detail')}")
            return True
        else:
            results.log_fail("Claim Purchase (Duplicate)", f"Wrong error message: {data.get('detail')}")
            return False
    else:
        results.log_fail("Claim Purchase (Duplicate)", f"Expected 400, got {response.status_code}: {response.text}")
        return False

def test_claim_purchase_invalid(results, user_token):
    """Test invalid purchase claim"""
    print("\n🚫 Testing Purchase Claim (Invalid Code)...")
    
    headers = {"Authorization": f"Bearer {user_token}"}
    
    response = make_request("POST", "/claim-purchase", headers=headers, data={"qr_data": "INVALID-CODE"})
    
    if not response:
        results.log_fail("Claim Purchase (Invalid)", "Request failed")
        return False
        
    if response.status_code == 400:
        results.log_pass("Claim Purchase (Invalid)")
        print(f"   Correctly rejected invalid code")
        return True
    else:
        results.log_fail("Claim Purchase (Invalid)", f"Expected 400, got {response.status_code}: {response.text}")
        return False

def test_claim_purchase_nonexistent(results, user_token):
    """Test non-existent purchase claim"""
    print("\n🚫 Testing Purchase Claim (Non-existent)...")
    
    headers = {"Authorization": f"Bearer {user_token}"}
    
    response = make_request("POST", "/claim-purchase", headers=headers, data={"qr_data": "PURCHASE:PUR-DOESNOTEXIST"})
    
    if not response:
        results.log_fail("Claim Purchase (Non-existent)", "Request failed")
        return False
        
    if response.status_code == 404:
        results.log_pass("Claim Purchase (Non-existent)")
        print(f"   Correctly returned 404 for non-existent purchase")
        return True
    else:
        results.log_fail("Claim Purchase (Non-existent)", f"Expected 404, got {response.status_code}: {response.text}")
        return False

def main():
    """Main test execution"""
    print("🚀 Starting Purchase QR Code Generation and Claim Flow Tests")
    print(f"Testing against: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    results = TestResults()
    
    # Step 1: Login as vendor
    vendor_token = test_vendor_login(results)
    if not vendor_token:
        print("❌ Cannot proceed without vendor token")
        return False
    
    # Step 2: Check/create vendor point rules
    if not test_vendor_point_rules(results, vendor_token):
        print("❌ Cannot proceed without point rules")
        return False
    
    # Step 3: Generate purchase QR
    qr_data = test_generate_purchase_qr(results, vendor_token)
    if not qr_data:
        print("❌ Cannot proceed without QR data")
        return False
    
    # Step 4: Login as user
    user_token = test_user_login(results)
    if not user_token:
        print("❌ Cannot proceed without user token")
        return False
    
    # Step 5: Claim the purchase QR (success)
    if not test_claim_purchase_success(results, user_token, qr_data):
        print("❌ Purchase claim failed")
        return False
    
    # Step 6: Try claiming same code again (should fail)
    test_claim_purchase_duplicate(results, user_token, qr_data)
    
    # Step 7: Try claiming invalid code (should fail)
    test_claim_purchase_invalid(results, user_token)
    
    # Step 8: Try claiming non-existent purchase (should fail)
    test_claim_purchase_nonexistent(results, user_token)
    
    # Final summary
    success = results.summary()
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)