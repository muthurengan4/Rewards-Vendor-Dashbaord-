#!/usr/bin/env python3
"""
Simplified Admin Settings API Test - Core Functionality
Tests the essential Admin Settings endpoints with timeout handling
"""

import requests
import json
import sys
from datetime import datetime

# API Configuration
BASE_URL = "https://point-vault.preview.emergentagent.com/api"

# Test Credentials
ADMIN_EMAIL = "admin@rewards.com"
ADMIN_PASSWORD = "admin123"

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

def make_request(method, endpoint, headers=None, data=None, timeout=30):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=timeout)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=timeout)
        elif method.upper() == "PUT":
            response = requests.put(url, headers=headers, json=data, timeout=timeout)
        else:
            raise ValueError(f"Unsupported method: {method}")
            
        return response
    except requests.exceptions.Timeout:
        print(f"Request timed out for {method} {url}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Request failed for {method} {url}: {e}")
        return None

def test_admin_login(results):
    """Test admin login and get token"""
    print("\n🔐 Testing Admin Login...")
    
    response = make_request("POST", "/admin/login", data={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if not response:
        results.log_fail("Admin Login", "Request failed")
        return None
        
    if response.status_code == 200:
        data = response.json()
        if "token" in data:
            results.log_pass("Admin Login")
            return data["token"]
        else:
            results.log_fail("Admin Login", "No token in response")
            return None
    else:
        results.log_fail("Admin Login", f"Status {response.status_code}: {response.text}")
        return None

def test_get_settings(results, admin_token):
    """Test GET /admin/settings - Core functionality"""
    print("\n📋 Testing GET /admin/settings...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = make_request("GET", "/admin/settings", headers=headers)
    
    if not response:
        results.log_fail("GET Settings", "Request failed")
        return None
        
    if response.status_code == 200:
        data = response.json()
        if "settings" not in data:
            results.log_fail("GET Settings", "No 'settings' field in response")
            return None
            
        settings = data["settings"]
        
        # Check essential fields are present
        essential_fields = [
            "app_name", "app_tagline", "currency_symbol", "currency_code", 
            "points_conversion_rate", "welcome_bonus_points", "maintenance_mode",
            "smtp_host", "smtp_port", "stripe_publishable_key", "stripe_secret_key",
            "default_commission_percent", "push_notifications_enabled"
        ]
        
        missing_fields = []
        for field in essential_fields:
            if field not in settings:
                missing_fields.append(field)
        
        if missing_fields:
            results.log_fail("GET Settings", f"Missing essential fields: {missing_fields}")
            return None
        
        # Check sensitive fields are masked when they have values
        if settings.get("smtp_password") and "smtp_password_masked" not in settings:
            results.log_fail("GET Settings", "SMTP password not masked")
            return None
            
        if settings.get("stripe_secret_key") and "stripe_secret_key_masked" not in settings:
            results.log_fail("GET Settings", "Stripe secret key not masked")
            return None
        
        results.log_pass("GET Settings")
        print(f"   App Name: {settings.get('app_name')}")
        print(f"   Currency: {settings.get('currency_symbol')} ({settings.get('currency_code')})")
        print(f"   Points Rate: {settings.get('points_conversion_rate')}")
        print(f"   Welcome Bonus: {settings.get('welcome_bonus_points')}")
        
        return settings
        
    else:
        results.log_fail("GET Settings", f"Status {response.status_code}: {response.text}")
        return None

def test_update_settings(results, admin_token):
    """Test PUT /admin/settings - Update functionality"""
    print("\n✏️ Testing PUT /admin/settings...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    update_data = {
        "app_tagline": "Your Ultimate Loyalty Rewards Platform",
        "points_conversion_rate": 120,
        "welcome_bonus_points": 150
    }
    
    response = make_request("PUT", "/admin/settings", headers=headers, data=update_data)
    
    if not response:
        results.log_fail("PUT Settings", "Request failed")
        return False
        
    if response.status_code == 200:
        data = response.json()
        if "message" not in data or "settings" not in data:
            results.log_fail("PUT Settings", "Missing message or settings in response")
            return False
            
        settings = data["settings"]
        
        # Verify updates
        if settings.get("app_tagline") != "Your Ultimate Loyalty Rewards Platform":
            results.log_fail("PUT Settings", f"App tagline not updated: {settings.get('app_tagline')}")
            return False
            
        if settings.get("points_conversion_rate") != 120:
            results.log_fail("PUT Settings", f"Points rate not updated: {settings.get('points_conversion_rate')}")
            return False
            
        if settings.get("welcome_bonus_points") != 150:
            results.log_fail("PUT Settings", f"Welcome bonus not updated: {settings.get('welcome_bonus_points')}")
            return False
        
        results.log_pass("PUT Settings")
        print(f"   Updated tagline: {settings.get('app_tagline')}")
        print(f"   Updated points rate: {settings.get('points_conversion_rate')}")
        print(f"   Updated welcome bonus: {settings.get('welcome_bonus_points')}")
        
        return True
        
    else:
        results.log_fail("PUT Settings", f"Status {response.status_code}: {response.text}")
        return False

def test_upload_logo(results, admin_token):
    """Test POST /admin/settings/logo"""
    print("\n🖼️ Testing POST /admin/settings/logo...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Create a simple base64 encoded image (1x1 pixel PNG)
    base64_logo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    
    response = make_request("POST", "/admin/settings/logo", headers=headers, data={
        "logo": base64_logo
    })
    
    if not response:
        results.log_fail("POST Logo Upload", "Request failed")
        return False
        
    if response.status_code == 200:
        data = response.json()
        if "message" not in data or "brand_logo" not in data:
            results.log_fail("POST Logo Upload", "Missing message or brand_logo in response")
            return False
            
        if data["brand_logo"] != base64_logo:
            results.log_fail("POST Logo Upload", "Logo data not returned correctly")
            return False
        
        results.log_pass("POST Logo Upload")
        print(f"   Logo uploaded successfully")
        
        return True
        
    else:
        results.log_fail("POST Logo Upload", f"Status {response.status_code}: {response.text}")
        return False

def test_email_validation(results, admin_token):
    """Test POST /admin/settings/test-email"""
    print("\n📧 Testing POST /admin/settings/test-email...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # First set SMTP settings
    smtp_response = make_request("PUT", "/admin/settings", headers=headers, data={
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 587,
        "smtp_username": "test@rewardshub.my",
        "smtp_password": "testpassword123"
    })
    
    if not smtp_response or smtp_response.status_code != 200:
        results.log_fail("Set SMTP for Email Test", "Failed to set SMTP settings")
        return False
    
    # Test email validation
    response = make_request("POST", "/admin/settings/test-email", headers=headers, data={
        "to_email": "admin@rewardshub.my"
    })
    
    if not response:
        results.log_fail("POST Test Email", "Request failed")
        return False
        
    if response.status_code == 200:
        data = response.json()
        if "message" in data and "status" in data and data["status"] == "ok":
            results.log_pass("POST Test Email")
            print(f"   Email validation successful: {data.get('message')}")
            return True
        else:
            results.log_fail("POST Test Email", f"Invalid response: {data}")
            return False
    else:
        results.log_fail("POST Test Email", f"Status {response.status_code}: {response.text}")
        return False

def test_security_basics(results, admin_token):
    """Test basic security - admin token required"""
    print("\n🔒 Testing Security (Admin Token Required)...")
    
    # Test without token
    response = make_request("GET", "/admin/settings", timeout=10)
    
    if response and response.status_code in [401, 403]:
        results.log_pass("Security - No Token")
        print(f"   Request without token correctly rejected with status {response.status_code}")
    else:
        if not response:
            results.log_fail("Security - No Token", "Request timed out")
        else:
            results.log_fail("Security - No Token", f"Expected 401/403, got {response.status_code}")

def main():
    """Main test execution"""
    print("🚀 Starting Admin Settings API Core Tests")
    print(f"Testing against: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    results = TestResults()
    
    # Step 1: Test basic security
    test_security_basics(results, None)
    
    # Step 2: Login as admin
    admin_token = test_admin_login(results)
    if not admin_token:
        print("❌ Cannot proceed without admin token")
        return False
    
    # Step 3: Test GET /admin/settings
    initial_settings = test_get_settings(results, admin_token)
    if not initial_settings:
        print("❌ Cannot proceed without initial settings")
        return False
    
    # Step 4: Test PUT /admin/settings
    test_update_settings(results, admin_token)
    
    # Step 5: Test logo upload
    test_upload_logo(results, admin_token)
    
    # Step 6: Test email validation
    test_email_validation(results, admin_token)
    
    # Final summary
    success = results.summary()
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)