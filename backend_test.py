#!/usr/bin/env python3
"""
Backend API Testing for Admin Settings API
Tests the Admin Settings endpoints: GET/PUT /admin/settings, POST /admin/settings/logo, POST /admin/settings/test-email
"""

import requests
import json
import sys
import base64
from datetime import datetime

# API Configuration
BASE_URL = "https://point-vault.preview.emergentagent.com/api"

# Test Credentials
ADMIN_EMAIL = "admin@rewards.com"
ADMIN_PASSWORD = "admin123"
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
            response = requests.get(url, headers=headers, timeout=60)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=60)
        elif method.upper() == "PUT":
            response = requests.put(url, headers=headers, json=data, timeout=60)
        else:
            raise ValueError(f"Unsupported method: {method}")
            
        return response
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

def test_get_settings_default(results, admin_token):
    """Test GET /admin/settings - should return default settings with auto-seeding"""
    print("\n📋 Testing GET /admin/settings (Default Settings)...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = make_request("GET", "/admin/settings", headers=headers)
    
    if not response:
        results.log_fail("GET Settings (Default)", "Request failed")
        return None
        
    if response.status_code == 200:
        data = response.json()
        if "settings" not in data:
            results.log_fail("GET Settings (Default)", "No 'settings' field in response")
            return None
            
        settings = data["settings"]
        
        # Check required fields are present
        required_fields = [
            "app_name", "app_tagline", "currency_symbol", "currency_code", 
            "points_conversion_rate", "welcome_bonus_points", "maintenance_mode",
            "brand_logo", "primary_color", "secondary_color", "background_color",
            "smtp_host", "smtp_port", "smtp_username", "smtp_password", 
            "smtp_from_email", "smtp_from_name", "smtp_use_tls",
            "stripe_publishable_key", "stripe_secret_key", "stripe_webhook_secret", "stripe_currency",
            "default_commission_percent", "min_payout_threshold", "payout_frequency",
            "push_notifications_enabled", "email_notifications_enabled", "sms_notifications_enabled",
            "social_facebook", "social_instagram", "social_twitter", "social_website",
            "terms_url", "privacy_url", "support_email", "support_phone"
        ]
        
        missing_fields = []
        for field in required_fields:
            if field not in settings:
                missing_fields.append(field)
        
        if missing_fields:
            results.log_fail("GET Settings (Default)", f"Missing fields: {missing_fields}")
            return None
        
        # Check app_name (could be default "RewardsHub" or previously updated)
        app_name = settings.get("app_name")
        if not app_name or app_name not in ["RewardsHub", "RewardsHub Malaysia"]:
            results.log_fail("GET Settings (Default)", f"Invalid app_name: {app_name}")
            return None
            
        if settings.get("currency_symbol") != "RM":
            results.log_fail("GET Settings (Default)", f"Wrong currency_symbol: {settings.get('currency_symbol')}")
            return None
            
        if settings.get("points_conversion_rate") != 100:
            results.log_fail("GET Settings (Default)", f"Wrong points_conversion_rate: {settings.get('points_conversion_rate')}")
            return None
        
        # Check sensitive fields are masked when they have values
        sensitive_fields = ["smtp_password", "stripe_secret_key", "stripe_webhook_secret"]
        for field in sensitive_fields:
            if settings.get(field):  # If field has a value
                masked_field = field + "_masked"
                if masked_field not in settings:
                    results.log_fail("GET Settings (Default)", f"Sensitive field {field} not masked")
                    return None
        
        results.log_pass("GET Settings (Default)")
        print(f"   App Name: {settings.get('app_name')}")
        print(f"   Currency: {settings.get('currency_symbol')} ({settings.get('currency_code')})")
        print(f"   Points Rate: {settings.get('points_conversion_rate')}")
        print(f"   Welcome Bonus: {settings.get('welcome_bonus_points')}")
        
        return settings
        
    else:
        results.log_fail("GET Settings (Default)", f"Status {response.status_code}: {response.text}")
        return None

def test_update_settings_app_info(results, admin_token):
    """Test PUT /admin/settings - Update app name and tagline"""
    print("\n✏️ Testing PUT /admin/settings (App Info)...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    update_data = {
        "app_name": "RewardsHub Malaysia",
        "app_tagline": "Your Malaysian Loyalty Rewards"
    }
    
    response = make_request("PUT", "/admin/settings", headers=headers, data=update_data)
    
    if not response:
        results.log_fail("PUT Settings (App Info)", "Request failed")
        return False
        
    if response.status_code == 200:
        data = response.json()
        if "message" not in data or "settings" not in data:
            results.log_fail("PUT Settings (App Info)", "Missing message or settings in response")
            return False
            
        settings = data["settings"]
        
        if settings.get("app_name") != "RewardsHub Malaysia":
            results.log_fail("PUT Settings (App Info)", f"App name not updated: {settings.get('app_name')}")
            return False
            
        if settings.get("app_tagline") != "Your Malaysian Loyalty Rewards":
            results.log_fail("PUT Settings (App Info)", f"App tagline not updated: {settings.get('app_tagline')}")
            return False
        
        results.log_pass("PUT Settings (App Info)")
        print(f"   Updated app_name: {settings.get('app_name')}")
        print(f"   Updated app_tagline: {settings.get('app_tagline')}")
        
        return True
        
    else:
        results.log_fail("PUT Settings (App Info)", f"Status {response.status_code}: {response.text}")
        return False

def test_update_settings_currency(results, admin_token):
    """Test PUT /admin/settings - Update currency settings"""
    print("\n💰 Testing PUT /admin/settings (Currency)...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    update_data = {
        "currency_symbol": "RM",
        "currency_code": "MYR",
        "points_conversion_rate": 150
    }
    
    response = make_request("PUT", "/admin/settings", headers=headers, data=update_data)
    
    if not response:
        results.log_fail("PUT Settings (Currency)", "Request failed")
        return False
        
    if response.status_code == 200:
        data = response.json()
        settings = data["settings"]
        
        if settings.get("currency_symbol") != "RM":
            results.log_fail("PUT Settings (Currency)", f"Currency symbol not updated: {settings.get('currency_symbol')}")
            return False
            
        if settings.get("currency_code") != "MYR":
            results.log_fail("PUT Settings (Currency)", f"Currency code not updated: {settings.get('currency_code')}")
            return False
            
        if settings.get("points_conversion_rate") != 150:
            results.log_fail("PUT Settings (Currency)", f"Points rate not updated: {settings.get('points_conversion_rate')}")
            return False
        
        results.log_pass("PUT Settings (Currency)")
        print(f"   Updated currency: {settings.get('currency_symbol')} ({settings.get('currency_code')})")
        print(f"   Updated points rate: {settings.get('points_conversion_rate')}")
        
        return True
        
    else:
        results.log_fail("PUT Settings (Currency)", f"Status {response.status_code}: {response.text}")
        return False

def test_update_settings_smtp(results, admin_token):
    """Test PUT /admin/settings - Update SMTP settings"""
    print("\n📧 Testing PUT /admin/settings (SMTP)...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    update_data = {
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 587,
        "smtp_username": "test@rewardshub.my",
        "smtp_password": "testpassword123"
    }
    
    response = make_request("PUT", "/admin/settings", headers=headers, data=update_data)
    
    if not response:
        results.log_fail("PUT Settings (SMTP)", "Request failed")
        return False
        
    if response.status_code == 200:
        data = response.json()
        settings = data["settings"]
        
        if settings.get("smtp_host") != "smtp.gmail.com":
            results.log_fail("PUT Settings (SMTP)", f"SMTP host not updated: {settings.get('smtp_host')}")
            return False
            
        if settings.get("smtp_port") != 587:
            results.log_fail("PUT Settings (SMTP)", f"SMTP port not updated: {settings.get('smtp_port')}")
            return False
            
        if settings.get("smtp_username") != "test@rewardshub.my":
            results.log_fail("PUT Settings (SMTP)", f"SMTP username not updated: {settings.get('smtp_username')}")
            return False
        
        # Check password is masked
        if "smtp_password_masked" not in settings:
            results.log_fail("PUT Settings (SMTP)", "SMTP password not masked in response")
            return False
        
        results.log_pass("PUT Settings (SMTP)")
        print(f"   Updated SMTP host: {settings.get('smtp_host')}")
        print(f"   Updated SMTP port: {settings.get('smtp_port')}")
        print(f"   Updated SMTP username: {settings.get('smtp_username')}")
        print(f"   SMTP password masked: {settings.get('smtp_password_masked')}")
        
        return True
        
    else:
        results.log_fail("PUT Settings (SMTP)", f"Status {response.status_code}: {response.text}")
        return False

def test_update_settings_stripe(results, admin_token):
    """Test PUT /admin/settings - Update Stripe settings"""
    print("\n💳 Testing PUT /admin/settings (Stripe)...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    update_data = {
        "stripe_publishable_key": "pk_test_123456789",
        "stripe_secret_key": "sk_test_987654321",
        "stripe_webhook_secret": "whsec_abcdefgh"
    }
    
    response = make_request("PUT", "/admin/settings", headers=headers, data=update_data)
    
    if not response:
        results.log_fail("PUT Settings (Stripe)", "Request failed")
        return False
        
    if response.status_code == 200:
        data = response.json()
        settings = data["settings"]
        
        if settings.get("stripe_publishable_key") != "pk_test_123456789":
            results.log_fail("PUT Settings (Stripe)", f"Stripe publishable key not updated: {settings.get('stripe_publishable_key')}")
            return False
        
        # Check secret keys are masked
        if "stripe_secret_key_masked" not in settings:
            results.log_fail("PUT Settings (Stripe)", "Stripe secret key not masked in response")
            return False
            
        if "stripe_webhook_secret_masked" not in settings:
            results.log_fail("PUT Settings (Stripe)", "Stripe webhook secret not masked in response")
            return False
        
        results.log_pass("PUT Settings (Stripe)")
        print(f"   Updated Stripe publishable key: {settings.get('stripe_publishable_key')}")
        print(f"   Stripe secret key masked: {settings.get('stripe_secret_key_masked')}")
        print(f"   Stripe webhook secret masked: {settings.get('stripe_webhook_secret_masked')}")
        
        return True
        
    else:
        results.log_fail("PUT Settings (Stripe)", f"Status {response.status_code}: {response.text}")
        return False

def test_update_settings_commission(results, admin_token):
    """Test PUT /admin/settings - Update commission settings"""
    print("\n💼 Testing PUT /admin/settings (Commission)...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    update_data = {
        "default_commission_percent": 15.0,
        "min_payout_threshold": 200.0,
        "payout_frequency": "weekly"
    }
    
    response = make_request("PUT", "/admin/settings", headers=headers, data=update_data)
    
    if not response:
        results.log_fail("PUT Settings (Commission)", "Request failed")
        return False
        
    if response.status_code == 200:
        data = response.json()
        settings = data["settings"]
        
        if settings.get("default_commission_percent") != 15.0:
            results.log_fail("PUT Settings (Commission)", f"Commission percent not updated: {settings.get('default_commission_percent')}")
            return False
            
        if settings.get("min_payout_threshold") != 200.0:
            results.log_fail("PUT Settings (Commission)", f"Payout threshold not updated: {settings.get('min_payout_threshold')}")
            return False
            
        if settings.get("payout_frequency") != "weekly":
            results.log_fail("PUT Settings (Commission)", f"Payout frequency not updated: {settings.get('payout_frequency')}")
            return False
        
        results.log_pass("PUT Settings (Commission)")
        print(f"   Updated commission: {settings.get('default_commission_percent')}%")
        print(f"   Updated payout threshold: RM{settings.get('min_payout_threshold')}")
        print(f"   Updated payout frequency: {settings.get('payout_frequency')}")
        
        return True
        
    else:
        results.log_fail("PUT Settings (Commission)", f"Status {response.status_code}: {response.text}")
        return False

def test_update_settings_notifications(results, admin_token):
    """Test PUT /admin/settings - Update notification toggles"""
    print("\n🔔 Testing PUT /admin/settings (Notifications)...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    update_data = {
        "push_notifications_enabled": False,
        "email_notifications_enabled": True,
        "sms_notifications_enabled": True
    }
    
    response = make_request("PUT", "/admin/settings", headers=headers, data=update_data)
    
    if not response:
        results.log_fail("PUT Settings (Notifications)", "Request failed")
        return False
        
    if response.status_code == 200:
        data = response.json()
        settings = data["settings"]
        
        if settings.get("push_notifications_enabled") != False:
            results.log_fail("PUT Settings (Notifications)", f"Push notifications not updated: {settings.get('push_notifications_enabled')}")
            return False
            
        if settings.get("email_notifications_enabled") != True:
            results.log_fail("PUT Settings (Notifications)", f"Email notifications not updated: {settings.get('email_notifications_enabled')}")
            return False
            
        if settings.get("sms_notifications_enabled") != True:
            results.log_fail("PUT Settings (Notifications)", f"SMS notifications not updated: {settings.get('sms_notifications_enabled')}")
            return False
        
        results.log_pass("PUT Settings (Notifications)")
        print(f"   Push notifications: {settings.get('push_notifications_enabled')}")
        print(f"   Email notifications: {settings.get('email_notifications_enabled')}")
        print(f"   SMS notifications: {settings.get('sms_notifications_enabled')}")
        
        return True
        
    else:
        results.log_fail("PUT Settings (Notifications)", f"Status {response.status_code}: {response.text}")
        return False

def test_update_settings_social(results, admin_token):
    """Test PUT /admin/settings - Update social links"""
    print("\n🌐 Testing PUT /admin/settings (Social Links)...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    update_data = {
        "social_facebook": "https://facebook.com/rewardshub",
        "social_instagram": "https://instagram.com/rewardshub",
        "social_twitter": "https://twitter.com/rewardshub",
        "social_website": "https://rewardshub.my"
    }
    
    response = make_request("PUT", "/admin/settings", headers=headers, data=update_data)
    
    if not response:
        results.log_fail("PUT Settings (Social)", "Request failed")
        return False
        
    if response.status_code == 200:
        data = response.json()
        settings = data["settings"]
        
        if settings.get("social_facebook") != "https://facebook.com/rewardshub":
            results.log_fail("PUT Settings (Social)", f"Facebook not updated: {settings.get('social_facebook')}")
            return False
            
        if settings.get("social_instagram") != "https://instagram.com/rewardshub":
            results.log_fail("PUT Settings (Social)", f"Instagram not updated: {settings.get('social_instagram')}")
            return False
            
        if settings.get("social_twitter") != "https://twitter.com/rewardshub":
            results.log_fail("PUT Settings (Social)", f"Twitter not updated: {settings.get('social_twitter')}")
            return False
            
        if settings.get("social_website") != "https://rewardshub.my":
            results.log_fail("PUT Settings (Social)", f"Website not updated: {settings.get('social_website')}")
            return False
        
        results.log_pass("PUT Settings (Social)")
        print(f"   Facebook: {settings.get('social_facebook')}")
        print(f"   Instagram: {settings.get('social_instagram')}")
        print(f"   Twitter: {settings.get('social_twitter')}")
        print(f"   Website: {settings.get('social_website')}")
        
        return True
        
    else:
        results.log_fail("PUT Settings (Social)", f"Status {response.status_code}: {response.text}")
        return False

def test_get_settings_persistence(results, admin_token):
    """Test GET /admin/settings - Verify updated values persist"""
    print("\n🔄 Testing GET /admin/settings (Persistence Check)...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = make_request("GET", "/admin/settings", headers=headers)
    
    if not response:
        results.log_fail("GET Settings (Persistence)", "Request failed")
        return False
        
    if response.status_code == 200:
        data = response.json()
        settings = data["settings"]
        
        # Check that our most recent updates persisted
        # We'll check the values we just set in the previous tests
        expected_values = {
            "currency_symbol": "RM",
            "currency_code": "MYR",
            "points_conversion_rate": 150,
            "smtp_host": "smtp.gmail.com",
            "smtp_port": 587,
            "smtp_username": "test@rewardshub.my",
            "stripe_publishable_key": "pk_test_123456789",
            "default_commission_percent": 15.0,
            "min_payout_threshold": 200.0,
            "payout_frequency": "weekly",
            "push_notifications_enabled": False,
            "email_notifications_enabled": True,
            "sms_notifications_enabled": True,
            "social_facebook": "https://facebook.com/rewardshub",
            "social_instagram": "https://instagram.com/rewardshub",
            "social_twitter": "https://twitter.com/rewardshub",
            "social_website": "https://rewardshub.my"
        }
        
        failed_checks = []
        for key, expected_value in expected_values.items():
            if settings.get(key) != expected_value:
                failed_checks.append(f"{key}: expected {expected_value}, got {settings.get(key)}")
        
        if failed_checks:
            results.log_fail("GET Settings (Persistence)", f"Values not persisted: {failed_checks}")
            return False
        
        results.log_pass("GET Settings (Persistence)")
        print(f"   All updated values persisted correctly")
        
        return True
        
    else:
        results.log_fail("GET Settings (Persistence)", f"Status {response.status_code}: {response.text}")
        return False

def test_update_settings_empty_body(results, admin_token):
    """Test PUT /admin/settings - Empty body should return 400"""
    print("\n🚫 Testing PUT /admin/settings (Empty Body)...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    response = make_request("PUT", "/admin/settings", headers=headers, data={})
    
    if not response:
        results.log_fail("PUT Settings (Empty Body)", "Request failed")
        return False
        
    if response.status_code == 400:
        data = response.json()
        if "No updates provided" in data.get("detail", ""):
            results.log_pass("PUT Settings (Empty Body)")
            print(f"   Correctly rejected empty body: {data.get('detail')}")
            return True
        else:
            results.log_fail("PUT Settings (Empty Body)", f"Wrong error message: {data.get('detail')}")
            return False
    else:
        results.log_fail("PUT Settings (Empty Body)", f"Expected 400, got {response.status_code}: {response.text}")
        return False

def test_upload_logo(results, admin_token):
    """Test POST /admin/settings/logo - Upload base64 logo"""
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
        
        # Verify logo persisted in settings
        settings_response = make_request("GET", "/admin/settings", headers=headers)
        if settings_response and settings_response.status_code == 200:
            settings_data = settings_response.json()
            if settings_data["settings"].get("brand_logo") == base64_logo:
                results.log_pass("Logo Persistence Check")
                print(f"   Logo persisted in settings")
            else:
                results.log_fail("Logo Persistence Check", "Logo not persisted in settings")
        
        return True
        
    else:
        results.log_fail("POST Logo Upload", f"Status {response.status_code}: {response.text}")
        return False

def test_upload_logo_empty_body(results, admin_token):
    """Test POST /admin/settings/logo - Empty body should return 400"""
    print("\n🚫 Testing POST /admin/settings/logo (Empty Body)...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    response = make_request("POST", "/admin/settings/logo", headers=headers, data={})
    
    if not response:
        results.log_fail("POST Logo Upload (Empty)", "Request failed")
        return False
        
    if response.status_code == 400:
        data = response.json()
        if "No logo data provided" in data.get("detail", ""):
            results.log_pass("POST Logo Upload (Empty)")
            print(f"   Correctly rejected empty body: {data.get('detail')}")
            return True
        else:
            results.log_fail("POST Logo Upload (Empty)", f"Wrong error message: {data.get('detail')}")
            return False
    else:
        results.log_fail("POST Logo Upload (Empty)", f"Expected 400, got {response.status_code}: {response.text}")
        return False

def test_email_validation_no_smtp(results, admin_token):
    """Test POST /admin/settings/test-email - Should fail if SMTP not configured"""
    print("\n📧 Testing POST /admin/settings/test-email (No SMTP)...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # First, clear SMTP settings
    clear_smtp_response = make_request("PUT", "/admin/settings", headers=headers, data={
        "smtp_host": "",
        "smtp_username": "",
        "smtp_password": ""
    })
    
    if not clear_smtp_response or clear_smtp_response.status_code != 200:
        results.log_fail("Clear SMTP Settings", "Failed to clear SMTP settings")
        return False
    
    # Now test email validation
    response = make_request("POST", "/admin/settings/test-email", headers=headers, data={
        "to_email": "test@example.com"
    })
    
    if not response:
        results.log_fail("POST Test Email (No SMTP)", "Request failed")
        return False
        
    if response.status_code == 400:
        data = response.json()
        if "Email settings not configured" in data.get("detail", ""):
            results.log_pass("POST Test Email (No SMTP)")
            print(f"   Correctly rejected when SMTP not configured: {data.get('detail')}")
            return True
        else:
            results.log_fail("POST Test Email (No SMTP)", f"Wrong error message: {data.get('detail')}")
            return False
    else:
        results.log_fail("POST Test Email (No SMTP)", f"Expected 400, got {response.status_code}: {response.text}")
        return False

def test_email_validation_with_smtp(results, admin_token):
    """Test POST /admin/settings/test-email - Should succeed when SMTP configured"""
    print("\n📧 Testing POST /admin/settings/test-email (With SMTP)...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # First, set SMTP settings
    smtp_response = make_request("PUT", "/admin/settings", headers=headers, data={
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 587,
        "smtp_username": "test@rewardshub.my",
        "smtp_password": "testpassword123"
    })
    
    if not smtp_response or smtp_response.status_code != 200:
        results.log_fail("Set SMTP Settings", "Failed to set SMTP settings")
        return False
    
    # Now test email validation
    response = make_request("POST", "/admin/settings/test-email", headers=headers, data={
        "to_email": "admin@rewardshub.my"
    })
    
    if not response:
        results.log_fail("POST Test Email (With SMTP)", "Request failed")
        return False
        
    if response.status_code == 200:
        data = response.json()
        if "message" in data and "status" in data:
            if data["status"] == "ok":
                results.log_pass("POST Test Email (With SMTP)")
                print(f"   Email validation successful: {data.get('message')}")
                return True
            else:
                results.log_fail("POST Test Email (With SMTP)", f"Wrong status: {data.get('status')}")
                return False
        else:
            results.log_fail("POST Test Email (With SMTP)", "Missing message or status in response")
            return False
    else:
        results.log_fail("POST Test Email (With SMTP)", f"Status {response.status_code}: {response.text}")
        return False

def test_security_user_token_rejection(results, user_token):
    """Test that user tokens are rejected for admin endpoints"""
    print("\n🔒 Testing Security - User Token Rejection...")
    
    headers = {"Authorization": f"Bearer {user_token}"}
    
    # Test GET /admin/settings with user token
    response = make_request("GET", "/admin/settings", headers=headers)
    
    if not response:
        results.log_fail("Security (User Token)", "Request failed")
        return False
        
    if response.status_code in [401, 403]:
        results.log_pass("Security (User Token)")
        print(f"   User token correctly rejected with status {response.status_code}")
        return True
    else:
        results.log_fail("Security (User Token)", f"Expected 401/403, got {response.status_code}: {response.text}")
        return False

def test_security_no_token(results):
    """Test that requests without tokens are rejected"""
    print("\n🔒 Testing Security - No Token...")
    
    response = make_request("GET", "/admin/settings")
    
    if not response:
        results.log_fail("Security (No Token)", "Request failed")
        return False
        
    if response.status_code in [401, 403]:
        results.log_pass("Security (No Token)")
        print(f"   Request without token correctly rejected with status {response.status_code}")
        return True
    else:
        results.log_fail("Security (No Token)", f"Expected 401/403, got {response.status_code}: {response.text}")
        return False

def main():
    """Main test execution"""
    print("🚀 Starting Admin Settings API Tests")
    print(f"Testing against: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    results = TestResults()
    
    # Step 1: Test security - no token
    test_security_no_token(results)
    
    # Step 2: Login as admin
    admin_token = test_admin_login(results)
    if not admin_token:
        print("❌ Cannot proceed without admin token")
        return False
    
    # Step 3: Login as user (for security tests)
    user_token = test_user_login(results)
    if not user_token:
        print("❌ Cannot proceed without user token")
        return False
    
    # Step 4: Test security - user token rejection
    test_security_user_token_rejection(results, user_token)
    
    # Step 5: Test GET /admin/settings (default settings)
    initial_settings = test_get_settings_default(results, admin_token)
    if not initial_settings:
        print("❌ Cannot proceed without initial settings")
        return False
    
    # Step 6: Test PUT /admin/settings updates
    test_update_settings_app_info(results, admin_token)
    test_update_settings_currency(results, admin_token)
    test_update_settings_smtp(results, admin_token)
    test_update_settings_stripe(results, admin_token)
    test_update_settings_commission(results, admin_token)
    test_update_settings_notifications(results, admin_token)
    test_update_settings_social(results, admin_token)
    
    # Step 7: Test persistence
    test_get_settings_persistence(results, admin_token)
    
    # Step 8: Test error cases
    test_update_settings_empty_body(results, admin_token)
    
    # Step 9: Test logo upload
    test_upload_logo(results, admin_token)
    test_upload_logo_empty_body(results, admin_token)
    
    # Step 10: Test email validation
    test_email_validation_no_smtp(results, admin_token)
    test_email_validation_with_smtp(results, admin_token)
    
    # Final summary
    success = results.summary()
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)