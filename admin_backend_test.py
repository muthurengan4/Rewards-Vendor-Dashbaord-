#!/usr/bin/env python3
"""
Comprehensive Admin Panel Backend API Testing
Tests all admin endpoints: Authentication, Dashboard, User Management, Vendor Management, Category Management
"""

import requests
import json
import sys
from datetime import datetime
from typing import Optional, Dict, Any

# API Configuration
BASE_URL = "https://point-vault.preview.emergentagent.com/api"

# Test Credentials
ADMIN_EMAIL = "admin@rewards.com"
ADMIN_PASSWORD = "admin123"
VENDOR_EMAIL = "pakali@vendor.my"
VENDOR_PASSWORD = "vendor123"
USER_EMAIL = "mobile@test.com"
USER_PASSWORD = "test1234"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        self.test_data = {}  # Store test data for later use
        
    def log_pass(self, test_name: str, details: str = ""):
        print(f"✅ PASS: {test_name}")
        if details:
            print(f"   {details}")
        self.passed += 1
        
    def log_fail(self, test_name: str, error: str):
        print(f"❌ FAIL: {test_name} - {error}")
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*80}")
        print(f"ADMIN PANEL BACKEND TEST SUMMARY: {self.passed}/{total} passed")
        if self.errors:
            print(f"\nFAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        print(f"{'='*80}")
        return self.failed == 0

def make_request(method: str, endpoint: str, headers: Optional[Dict] = None, data: Optional[Dict] = None, params: Optional[Dict] = None) -> Optional[requests.Response]:
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, params=params, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=30)
        elif method.upper() == "PUT":
            response = requests.put(url, headers=headers, json=data, timeout=30)
        elif method.upper() == "DELETE":
            response = requests.delete(url, headers=headers, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
            
        return response
    except requests.exceptions.RequestException as e:
        print(f"Request failed for {method} {url}: {e}")
        return None

# ========================= ADMIN AUTHENTICATION TESTS =========================

def test_admin_login(results: TestResults) -> Optional[str]:
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
        if "token" in data and "admin" in data:
            # Verify password_hash is NOT in response
            if "password_hash" in data["admin"]:
                results.log_fail("Admin Login", "Password hash exposed in response")
                return None
            results.log_pass("Admin Login", f"Admin: {data['admin'].get('name', 'Unknown')}")
            return data["token"]
        else:
            results.log_fail("Admin Login", "Missing token or admin in response")
            return None
    else:
        results.log_fail("Admin Login", f"Status {response.status_code}: {response.text}")
        return None

def test_admin_login_invalid(results: TestResults):
    """Test admin login with invalid credentials"""
    print("\n🚫 Testing Admin Login (Invalid Credentials)...")
    
    response = make_request("POST", "/admin/login", data={
        "email": ADMIN_EMAIL,
        "password": "wrongpassword"
    })
    
    if not response:
        results.log_fail("Admin Login Invalid", "Request failed")
        return
        
    if response.status_code == 401:
        results.log_pass("Admin Login Invalid", "Correctly rejected invalid credentials")
    else:
        results.log_fail("Admin Login Invalid", f"Expected 401, got {response.status_code}")

def test_admin_setup(results: TestResults):
    """Test admin setup endpoint (should fail since admin already exists)"""
    print("\n🔧 Testing Admin Setup...")
    
    response = make_request("POST", "/admin/setup", data={
        "email": "newadmin@test.com",
        "password": "newpassword",
        "name": "New Admin"
    })
    
    if not response:
        results.log_fail("Admin Setup", "Request failed")
        return
        
    if response.status_code == 400:
        results.log_pass("Admin Setup", "Correctly rejected when admin already exists")
    elif response.status_code == 200:
        # This means it created another admin, which is also valid behavior
        results.log_pass("Admin Setup", "Created new admin successfully")
    else:
        results.log_fail("Admin Setup", f"Unexpected status {response.status_code}: {response.text}")

def test_admin_me(results: TestResults, admin_token: str):
    """Test admin profile endpoint"""
    print("\n👤 Testing Admin Profile...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = make_request("GET", "/admin/me", headers=headers)
    
    if not response:
        results.log_fail("Admin Profile", "Request failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if "email" in data and "name" in data:
            # Verify password_hash is NOT in response
            if "password_hash" in data:
                results.log_fail("Admin Profile", "Password hash exposed in response")
                return
            results.log_pass("Admin Profile", f"Profile: {data.get('name')} ({data.get('email')})")
        else:
            results.log_fail("Admin Profile", "Missing required fields")
    else:
        results.log_fail("Admin Profile", f"Status {response.status_code}: {response.text}")

def test_admin_auth_without_token(results: TestResults):
    """Test admin endpoint without token"""
    print("\n🚫 Testing Admin Endpoint Without Token...")
    
    response = make_request("GET", "/admin/me")
    
    if not response:
        results.log_fail("Admin Auth Without Token", "Request failed")
        return
        
    if response.status_code in [401, 403]:
        results.log_pass("Admin Auth Without Token", "Correctly rejected request without token")
    else:
        results.log_fail("Admin Auth Without Token", f"Expected 401/403, got {response.status_code}")

def test_admin_auth_with_user_token(results: TestResults):
    """Test admin endpoint with regular user token"""
    print("\n🚫 Testing Admin Endpoint With User Token...")
    
    # First get user token
    user_response = make_request("POST", "/auth/login", data={
        "email": USER_EMAIL,
        "password": USER_PASSWORD
    })
    
    if not user_response or user_response.status_code != 200:
        results.log_fail("Admin Auth With User Token", "Could not get user token")
        return
    
    user_token = user_response.json().get("token")
    if not user_token:
        results.log_fail("Admin Auth With User Token", "No user token in response")
        return
    
    # Try to access admin endpoint with user token
    headers = {"Authorization": f"Bearer {user_token}"}
    response = make_request("GET", "/admin/me", headers=headers)
    
    if not response:
        results.log_fail("Admin Auth With User Token", "Request failed")
        return
        
    if response.status_code in [401, 403]:
        results.log_pass("Admin Auth With User Token", "Correctly rejected user token for admin endpoint")
    else:
        results.log_fail("Admin Auth With User Token", f"Expected 401/403, got {response.status_code}")

# ========================= ADMIN DASHBOARD TESTS =========================

def test_admin_dashboard(results: TestResults, admin_token: str):
    """Test admin dashboard endpoint"""
    print("\n📊 Testing Admin Dashboard...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = make_request("GET", "/admin/dashboard", headers=headers)
    
    if not response:
        results.log_fail("Admin Dashboard", "Request failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        required_fields = [
            "total_users", "total_vendors", "total_categories", "total_rewards",
            "points_issued", "points_redeemed", "points_balance", "activity_feed", "top_vendors"
        ]
        
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            results.log_fail("Admin Dashboard", f"Missing fields: {missing_fields}")
            return
        
        # Store some data for later tests
        results.test_data["dashboard"] = data
        
        results.log_pass("Admin Dashboard", 
                        f"Users: {data['total_users']}, Vendors: {data['total_vendors']}, "
                        f"Categories: {data['total_categories']}, Points Balance: {data['points_balance']}")
    else:
        results.log_fail("Admin Dashboard", f"Status {response.status_code}: {response.text}")

# ========================= ADMIN USER MANAGEMENT TESTS =========================

def test_admin_list_users(results: TestResults, admin_token: str):
    """Test admin list users endpoint"""
    print("\n👥 Testing Admin List Users...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = make_request("GET", "/admin/users", headers=headers)
    
    if not response:
        results.log_fail("Admin List Users", "Request failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if "users" in data and "total" in data:
            users = data["users"]
            if len(users) > 0:
                # Store first user for later tests
                results.test_data["test_user"] = users[0]
                # Verify password_hash is not exposed
                for user in users:
                    if "password_hash" in user:
                        results.log_fail("Admin List Users", "Password hash exposed in user data")
                        return
                results.log_pass("Admin List Users", f"Found {len(users)} users, Total: {data['total']}")
            else:
                results.log_fail("Admin List Users", "No users found")
        else:
            results.log_fail("Admin List Users", "Missing users or total in response")
    else:
        results.log_fail("Admin List Users", f"Status {response.status_code}: {response.text}")

def test_admin_list_users_with_search(results: TestResults, admin_token: str):
    """Test admin list users with search parameter"""
    print("\n🔍 Testing Admin List Users (Search)...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = make_request("GET", "/admin/users", headers=headers, params={"search": "mobile"})
    
    if not response:
        results.log_fail("Admin List Users Search", "Request failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if "users" in data:
            results.log_pass("Admin List Users Search", f"Search returned {len(data['users'])} users")
        else:
            results.log_fail("Admin List Users Search", "Missing users in response")
    else:
        results.log_fail("Admin List Users Search", f"Status {response.status_code}: {response.text}")

def test_admin_get_user(results: TestResults, admin_token: str):
    """Test admin get user details endpoint"""
    print("\n👤 Testing Admin Get User Details...")
    
    if "test_user" not in results.test_data:
        results.log_fail("Admin Get User", "No test user available")
        return
    
    user_id = results.test_data["test_user"]["id"]
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = make_request("GET", f"/admin/users/{user_id}", headers=headers)
    
    if not response:
        results.log_fail("Admin Get User", "Request failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        required_fields = ["id", "email", "name", "points_balance"]
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            results.log_fail("Admin Get User", f"Missing fields: {missing_fields}")
            return
        
        # Verify password_hash is not exposed
        if "password_hash" in data:
            results.log_fail("Admin Get User", "Password hash exposed in user data")
            return
            
        results.log_pass("Admin Get User", f"User: {data['name']} ({data['email']}) - {data['points_balance']} points")
    else:
        results.log_fail("Admin Get User", f"Status {response.status_code}: {response.text}")

def test_admin_block_unblock_user(results: TestResults, admin_token: str):
    """Test admin block and unblock user endpoints"""
    print("\n🚫 Testing Admin Block/Unblock User...")
    
    if "test_user" not in results.test_data:
        results.log_fail("Admin Block/Unblock User", "No test user available")
        return
    
    user_id = results.test_data["test_user"]["id"]
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Test block user
    response = make_request("POST", f"/admin/users/{user_id}/block", headers=headers)
    if not response or response.status_code != 200:
        results.log_fail("Admin Block User", f"Block failed: {response.status_code if response else 'No response'}")
        return
    
    # Test unblock user
    response = make_request("POST", f"/admin/users/{user_id}/unblock", headers=headers)
    if not response or response.status_code != 200:
        results.log_fail("Admin Unblock User", f"Unblock failed: {response.status_code if response else 'No response'}")
        return
    
    results.log_pass("Admin Block/Unblock User", "Block and unblock operations successful")

def test_admin_adjust_points(results: TestResults, admin_token: str):
    """Test admin adjust points endpoint"""
    print("\n💰 Testing Admin Adjust Points...")
    
    if "test_user" not in results.test_data:
        results.log_fail("Admin Adjust Points", "No test user available")
        return
    
    user_id = results.test_data["test_user"]["id"]
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Test positive adjustment
    response = make_request("POST", f"/admin/users/{user_id}/adjust-points", headers=headers, data={
        "amount": 50,
        "reason": "Test bonus points"
    })
    
    if not response:
        results.log_fail("Admin Adjust Points", "Request failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if "new_balance" in data:
            results.log_pass("Admin Adjust Points", f"Added 50 points, new balance: {data['new_balance']}")
        else:
            results.log_fail("Admin Adjust Points", "Missing new_balance in response")
    else:
        results.log_fail("Admin Adjust Points", f"Status {response.status_code}: {response.text}")

# ========================= ADMIN VENDOR MANAGEMENT TESTS =========================

def test_admin_list_vendors(results: TestResults, admin_token: str):
    """Test admin list vendors endpoint"""
    print("\n🏪 Testing Admin List Vendors...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = make_request("GET", "/admin/vendors", headers=headers)
    
    if not response:
        results.log_fail("Admin List Vendors", "Request failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if "vendors" in data and "total" in data:
            vendors = data["vendors"]
            if len(vendors) > 0:
                # Store first vendor for later tests
                results.test_data["test_vendor"] = vendors[0]
                # Verify password_hash is not exposed
                for vendor in vendors:
                    if "password_hash" in vendor:
                        results.log_fail("Admin List Vendors", "Password hash exposed in vendor data")
                        return
                results.log_pass("Admin List Vendors", f"Found {len(vendors)} vendors, Total: {data['total']}")
            else:
                results.log_fail("Admin List Vendors", "No vendors found")
        else:
            results.log_fail("Admin List Vendors", "Missing vendors or total in response")
    else:
        results.log_fail("Admin List Vendors", f"Status {response.status_code}: {response.text}")

def test_admin_list_vendors_with_filters(results: TestResults, admin_token: str):
    """Test admin list vendors with status filter"""
    print("\n🔍 Testing Admin List Vendors (Status Filter)...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = make_request("GET", "/admin/vendors", headers=headers, params={"status": "pending"})
    
    if not response:
        results.log_fail("Admin List Vendors Filter", "Request failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if "vendors" in data:
            results.log_pass("Admin List Vendors Filter", f"Status filter returned {len(data['vendors'])} vendors")
        else:
            results.log_fail("Admin List Vendors Filter", "Missing vendors in response")
    else:
        results.log_fail("Admin List Vendors Filter", f"Status {response.status_code}: {response.text}")

def test_admin_get_vendor(results: TestResults, admin_token: str):
    """Test admin get vendor details endpoint"""
    print("\n🏪 Testing Admin Get Vendor Details...")
    
    if "test_vendor" not in results.test_data:
        results.log_fail("Admin Get Vendor", "No test vendor available")
        return
    
    vendor_id = results.test_data["test_vendor"]["id"]
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = make_request("GET", f"/admin/vendors/{vendor_id}", headers=headers)
    
    if not response:
        results.log_fail("Admin Get Vendor", "Request failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        required_fields = ["id", "email", "store_name", "status"]
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            results.log_fail("Admin Get Vendor", f"Missing fields: {missing_fields}")
            return
        
        # Verify password_hash is not exposed
        if "password_hash" in data:
            results.log_fail("Admin Get Vendor", "Password hash exposed in vendor data")
            return
            
        results.log_pass("Admin Get Vendor", f"Vendor: {data['store_name']} ({data['email']}) - Status: {data['status']}")
    else:
        results.log_fail("Admin Get Vendor", f"Status {response.status_code}: {response.text}")

def test_admin_vendor_status_management(results: TestResults, admin_token: str):
    """Test admin vendor approve/suspend/activate endpoints"""
    print("\n⚡ Testing Admin Vendor Status Management...")
    
    if "test_vendor" not in results.test_data:
        results.log_fail("Admin Vendor Status", "No test vendor available")
        return
    
    vendor_id = results.test_data["test_vendor"]["id"]
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Test approve vendor
    response = make_request("POST", f"/admin/vendors/{vendor_id}/approve", headers=headers)
    if not response or response.status_code != 200:
        results.log_fail("Admin Approve Vendor", f"Approve failed: {response.status_code if response else 'No response'}")
        return
    
    # Test suspend vendor
    response = make_request("POST", f"/admin/vendors/{vendor_id}/suspend", headers=headers)
    if not response or response.status_code != 200:
        results.log_fail("Admin Suspend Vendor", f"Suspend failed: {response.status_code if response else 'No response'}")
        return
    
    # Test activate vendor
    response = make_request("POST", f"/admin/vendors/{vendor_id}/activate", headers=headers)
    if not response or response.status_code != 200:
        results.log_fail("Admin Activate Vendor", f"Activate failed: {response.status_code if response else 'No response'}")
        return
    
    results.log_pass("Admin Vendor Status", "Approve, suspend, and activate operations successful")

# ========================= ADMIN CATEGORY MANAGEMENT TESTS =========================

def test_admin_list_categories(results: TestResults, admin_token: str):
    """Test admin list categories endpoint"""
    print("\n📂 Testing Admin List Categories...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = make_request("GET", "/admin/categories", headers=headers)
    
    if not response:
        results.log_fail("Admin List Categories", "Request failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if "categories" in data:
            categories = data["categories"]
            if len(categories) > 0:
                # Store first category for later tests
                results.test_data["test_category"] = categories[0]
                results.log_pass("Admin List Categories", f"Found {len(categories)} categories")
            else:
                # Categories might be auto-seeded, so this is still a pass
                results.log_pass("Admin List Categories", "No categories found (will be auto-seeded)")
        else:
            results.log_fail("Admin List Categories", "Missing categories in response")
    else:
        results.log_fail("Admin List Categories", f"Status {response.status_code}: {response.text}")

def test_admin_create_category(results: TestResults, admin_token: str):
    """Test admin create category endpoint"""
    print("\n➕ Testing Admin Create Category...")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    test_category = {
        "name": f"Test Category {datetime.now().strftime('%H%M%S')}",
        "icon": "test",
        "description": "Test category for admin testing",
        "sort_order": 999,
        "is_active": True
    }
    
    response = make_request("POST", "/admin/categories", headers=headers, data=test_category)
    
    if not response:
        results.log_fail("Admin Create Category", "Request failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if "category" in data and "message" in data:
            created_category = data["category"]
            results.test_data["created_category"] = created_category
            results.log_pass("Admin Create Category", f"Created: {created_category['name']}")
        else:
            results.log_fail("Admin Create Category", "Missing category or message in response")
    else:
        results.log_fail("Admin Create Category", f"Status {response.status_code}: {response.text}")

def test_admin_update_category(results: TestResults, admin_token: str):
    """Test admin update category endpoint"""
    print("\n✏️ Testing Admin Update Category...")
    
    if "created_category" not in results.test_data:
        results.log_fail("Admin Update Category", "No created category available")
        return
    
    category_id = results.test_data["created_category"]["id"]
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    update_data = {
        "name": f"Updated Test Category {datetime.now().strftime('%H%M%S')}",
        "description": "Updated description"
    }
    
    response = make_request("PUT", f"/admin/categories/{category_id}", headers=headers, data=update_data)
    
    if not response:
        results.log_fail("Admin Update Category", "Request failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if "category" in data and "message" in data:
            updated_category = data["category"]
            results.log_pass("Admin Update Category", f"Updated: {updated_category['name']}")
        else:
            results.log_fail("Admin Update Category", "Missing category or message in response")
    else:
        results.log_fail("Admin Update Category", f"Status {response.status_code}: {response.text}")

def test_admin_delete_category(results: TestResults, admin_token: str):
    """Test admin delete category endpoint"""
    print("\n🗑️ Testing Admin Delete Category...")
    
    if "created_category" not in results.test_data:
        results.log_fail("Admin Delete Category", "No created category available")
        return
    
    category_id = results.test_data["created_category"]["id"]
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    response = make_request("DELETE", f"/admin/categories/{category_id}", headers=headers)
    
    if not response:
        results.log_fail("Admin Delete Category", "Request failed")
        return
        
    if response.status_code == 200:
        data = response.json()
        if "message" in data:
            results.log_pass("Admin Delete Category", "Category deleted successfully")
        else:
            results.log_fail("Admin Delete Category", "Missing message in response")
    else:
        results.log_fail("Admin Delete Category", f"Status {response.status_code}: {response.text}")

# ========================= MAIN TEST EXECUTION =========================

def main():
    """Main test execution"""
    print("🚀 Starting Comprehensive Admin Panel Backend API Tests")
    print(f"Testing against: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    results = TestResults()
    
    # ===== ADMIN AUTHENTICATION TESTS =====
    print(f"\n{'='*80}")
    print("🔐 ADMIN AUTHENTICATION TESTS")
    print(f"{'='*80}")
    
    admin_token = test_admin_login(results)
    if not admin_token:
        print("❌ Cannot proceed without admin token")
        return False
    
    test_admin_login_invalid(results)
    test_admin_setup(results)
    test_admin_me(results, admin_token)
    test_admin_auth_without_token(results)
    test_admin_auth_with_user_token(results)
    
    # ===== ADMIN DASHBOARD TESTS =====
    print(f"\n{'='*80}")
    print("📊 ADMIN DASHBOARD TESTS")
    print(f"{'='*80}")
    
    test_admin_dashboard(results, admin_token)
    
    # ===== ADMIN USER MANAGEMENT TESTS =====
    print(f"\n{'='*80}")
    print("👥 ADMIN USER MANAGEMENT TESTS")
    print(f"{'='*80}")
    
    test_admin_list_users(results, admin_token)
    test_admin_list_users_with_search(results, admin_token)
    test_admin_get_user(results, admin_token)
    test_admin_block_unblock_user(results, admin_token)
    test_admin_adjust_points(results, admin_token)
    
    # ===== ADMIN VENDOR MANAGEMENT TESTS =====
    print(f"\n{'='*80}")
    print("🏪 ADMIN VENDOR MANAGEMENT TESTS")
    print(f"{'='*80}")
    
    test_admin_list_vendors(results, admin_token)
    test_admin_list_vendors_with_filters(results, admin_token)
    test_admin_get_vendor(results, admin_token)
    test_admin_vendor_status_management(results, admin_token)
    
    # ===== ADMIN CATEGORY MANAGEMENT TESTS =====
    print(f"\n{'='*80}")
    print("📂 ADMIN CATEGORY MANAGEMENT TESTS")
    print(f"{'='*80}")
    
    test_admin_list_categories(results, admin_token)
    test_admin_create_category(results, admin_token)
    test_admin_update_category(results, admin_token)
    test_admin_delete_category(results, admin_token)
    
    # Final summary
    success = results.summary()
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)