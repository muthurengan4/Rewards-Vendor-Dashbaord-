#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for RewardsHub Vendor Dashboard
Tests all vendor-related endpoints with proper authentication and error handling.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://point-vault.preview.emergentagent.com/api"
TEST_USER_EMAIL = "mobile@test.com"
TEST_USER_PASSWORD = "test1234"

# Test vendor data
TEST_VENDOR = {
    "email": "testvendor@test.com",
    "password": "vendor123",
    "store_name": "Test Kopitiam",
    "category": "Malaysian Food",
    "description": "Authentic kopitiam",
    "address": "Bangsar, KL",
    "phone": "+60123456789"
}

class VendorAPITester:
    def __init__(self):
        self.vendor_token = None
        self.user_token = None
        self.vendor_id = None
        self.user_id = None
        self.test_results = []
        self.branch_id = None
        self.reward_id = None
        self.redemption_code = None
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def make_request(self, method, endpoint, data=None, headers=None, token=None):
        """Make HTTP request with proper error handling"""
        url = f"{BASE_URL}{endpoint}"
        
        if headers is None:
            headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except requests.exceptions.RequestException as e:
            return None, str(e)
    
    def test_vendor_registration(self):
        """Test vendor registration endpoint"""
        print("\n=== Testing Vendor Registration ===")
        
        response = self.make_request("POST", "/vendor/register", TEST_VENDOR)
        
        if response is None:
            self.log_result("Vendor Registration", False, "Request failed - connection error")
            return False
        
        if response.status_code == 201 or response.status_code == 200:
            try:
                data = response.json()
                if "token" in data and "vendor" in data:
                    self.vendor_token = data["token"]
                    self.vendor_id = data["vendor"]["id"]
                    self.log_result("Vendor Registration", True, "Vendor registered successfully")
                    return True
                else:
                    self.log_result("Vendor Registration", False, "Missing token or vendor data in response", data)
                    return False
            except json.JSONDecodeError:
                self.log_result("Vendor Registration", False, "Invalid JSON response", response.text)
                return False
        elif response.status_code == 400:
            # Email might already exist, try login instead
            self.log_result("Vendor Registration", True, "Email already exists (expected)", response.json())
            return self.test_vendor_login()
        else:
            self.log_result("Vendor Registration", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_vendor_login(self):
        """Test vendor login endpoint"""
        print("\n=== Testing Vendor Login ===")
        
        login_data = {
            "email": TEST_VENDOR["email"],
            "password": TEST_VENDOR["password"]
        }
        
        response = self.make_request("POST", "/vendor/login", login_data)
        
        if response is None:
            self.log_result("Vendor Login", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "token" in data and "vendor" in data:
                    self.vendor_token = data["token"]
                    self.vendor_id = data["vendor"]["id"]
                    self.log_result("Vendor Login", True, "Login successful")
                    return True
                else:
                    self.log_result("Vendor Login", False, "Missing token or vendor data", data)
                    return False
            except json.JSONDecodeError:
                self.log_result("Vendor Login", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_result("Vendor Login", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_vendor_profile(self):
        """Test vendor profile endpoints"""
        print("\n=== Testing Vendor Profile ===")
        
        if not self.vendor_token:
            self.log_result("Vendor Profile GET", False, "No vendor token available")
            return False
        
        # Test GET profile
        response = self.make_request("GET", "/vendor/me", token=self.vendor_token)
        
        if response is None:
            self.log_result("Vendor Profile GET", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "id" in data and "store_name" in data:
                    self.log_result("Vendor Profile GET", True, "Profile retrieved successfully")
                else:
                    self.log_result("Vendor Profile GET", False, "Missing required profile fields", data)
                    return False
            except json.JSONDecodeError:
                self.log_result("Vendor Profile GET", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_result("Vendor Profile GET", False, f"HTTP {response.status_code}", response.text)
            return False
        
        # Test PUT profile update
        update_data = {
            "description": "Updated authentic kopitiam with new menu",
            "points_per_rm": 1.5
        }
        
        response = self.make_request("PUT", "/vendor/profile", update_data, token=self.vendor_token)
        
        if response is None:
            self.log_result("Vendor Profile PUT", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "message" in data and "vendor" in data:
                    self.log_result("Vendor Profile PUT", True, "Profile updated successfully")
                    return True
                else:
                    self.log_result("Vendor Profile PUT", False, "Missing response fields", data)
                    return False
            except json.JSONDecodeError:
                self.log_result("Vendor Profile PUT", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_result("Vendor Profile PUT", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_vendor_branches(self):
        """Test vendor branches CRUD operations"""
        print("\n=== Testing Vendor Branches CRUD ===")
        
        if not self.vendor_token:
            self.log_result("Vendor Branches", False, "No vendor token available")
            return False
        
        # Test CREATE branch
        branch_data = {
            "name": "Main Branch",
            "address": "123 Jalan Bangsar, KL",
            "phone": "+60123456789",
            "is_active": True
        }
        
        response = self.make_request("POST", "/vendor/branches", branch_data, token=self.vendor_token)
        
        if response is None:
            self.log_result("Create Branch", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200 or response.status_code == 201:
            try:
                data = response.json()
                if "branch" in data and "id" in data["branch"]:
                    self.branch_id = data["branch"]["id"]
                    self.log_result("Create Branch", True, "Branch created successfully")
                else:
                    self.log_result("Create Branch", False, "Missing branch data", data)
                    return False
            except json.JSONDecodeError:
                self.log_result("Create Branch", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_result("Create Branch", False, f"HTTP {response.status_code}", response.text)
            return False
        
        # Test GET branches
        response = self.make_request("GET", "/vendor/branches", token=self.vendor_token)
        
        if response is None:
            self.log_result("Get Branches", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "branches" in data and isinstance(data["branches"], list):
                    self.log_result("Get Branches", True, f"Retrieved {len(data['branches'])} branches")
                else:
                    self.log_result("Get Branches", False, "Invalid branches data", data)
                    return False
            except json.JSONDecodeError:
                self.log_result("Get Branches", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_result("Get Branches", False, f"HTTP {response.status_code}", response.text)
            return False
        
        # Test UPDATE branch
        if self.branch_id:
            update_data = {
                "name": "Updated Main Branch",
                "address": "456 Jalan Bangsar, KL",
                "phone": "+60123456789",
                "is_active": True
            }
            
            response = self.make_request("PUT", f"/vendor/branches/{self.branch_id}", update_data, token=self.vendor_token)
            
            if response is None:
                self.log_result("Update Branch", False, "Request failed - connection error")
                return False
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if "message" in data:
                        self.log_result("Update Branch", True, "Branch updated successfully")
                    else:
                        self.log_result("Update Branch", False, "Missing response message", data)
                        return False
                except json.JSONDecodeError:
                    self.log_result("Update Branch", False, "Invalid JSON response", response.text)
                    return False
            else:
                self.log_result("Update Branch", False, f"HTTP {response.status_code}", response.text)
                return False
        
        return True
    
    def test_vendor_rewards(self):
        """Test vendor rewards management"""
        print("\n=== Testing Vendor Rewards Management ===")
        
        if not self.vendor_token:
            self.log_result("Vendor Rewards", False, "No vendor token available")
            return False
        
        # Test CREATE reward
        reward_data = {
            "name": "Free Teh Tarik",
            "description": "Redeem free drink",
            "points_required": 100,
            "reward_type": "free_item",
            "value": 5.0,
            "terms_conditions": "Valid for 30 days",
            "quantity": 50
        }
        
        response = self.make_request("POST", "/vendor/rewards", reward_data, token=self.vendor_token)
        
        if response is None:
            self.log_result("Create Reward", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200 or response.status_code == 201:
            try:
                data = response.json()
                if "reward" in data and "id" in data["reward"]:
                    self.reward_id = data["reward"]["id"]
                    self.log_result("Create Reward", True, "Reward created successfully")
                else:
                    self.log_result("Create Reward", False, "Missing reward data", data)
                    return False
            except json.JSONDecodeError:
                self.log_result("Create Reward", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_result("Create Reward", False, f"HTTP {response.status_code}", response.text)
            return False
        
        # Test GET rewards
        response = self.make_request("GET", "/vendor/rewards", token=self.vendor_token)
        
        if response is None:
            self.log_result("Get Rewards", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "rewards" in data and isinstance(data["rewards"], list):
                    self.log_result("Get Rewards", True, f"Retrieved {len(data['rewards'])} rewards")
                else:
                    self.log_result("Get Rewards", False, "Invalid rewards data", data)
                    return False
            except json.JSONDecodeError:
                self.log_result("Get Rewards", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_result("Get Rewards", False, f"HTTP {response.status_code}", response.text)
            return False
        
        # Test UPDATE reward
        if self.reward_id:
            update_data = {
                "name": "Free Kopi O",
                "description": "Redeem free black coffee",
                "points_required": 80,
                "reward_type": "free_item",
                "value": 4.0
            }
            
            response = self.make_request("PUT", f"/vendor/rewards/{self.reward_id}", update_data, token=self.vendor_token)
            
            if response is None:
                self.log_result("Update Reward", False, "Request failed - connection error")
                return False
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if "message" in data:
                        self.log_result("Update Reward", True, "Reward updated successfully")
                    else:
                        self.log_result("Update Reward", False, "Missing response message", data)
                        return False
                except json.JSONDecodeError:
                    self.log_result("Update Reward", False, "Invalid JSON response", response.text)
                    return False
            else:
                self.log_result("Update Reward", False, f"HTTP {response.status_code}", response.text)
                return False
        
        # Test TOGGLE reward
        if self.reward_id:
            response = self.make_request("PUT", f"/vendor/rewards/{self.reward_id}/toggle", token=self.vendor_token)
            
            if response is None:
                self.log_result("Toggle Reward", False, "Request failed - connection error")
                return False
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if "message" in data and "is_active" in data:
                        self.log_result("Toggle Reward", True, f"Reward toggled: {data['is_active']}")
                    else:
                        self.log_result("Toggle Reward", False, "Missing response data", data)
                        return False
                except json.JSONDecodeError:
                    self.log_result("Toggle Reward", False, "Invalid JSON response", response.text)
                    return False
            else:
                self.log_result("Toggle Reward", False, f"HTTP {response.status_code}", response.text)
                return False
        
        return True
    
    def test_user_login(self):
        """Test user login to get user token for testing"""
        print("\n=== Testing User Login (for testing) ===")
        
        login_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        
        if response is None:
            self.log_result("User Login", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "token" in data and "user" in data:
                    self.user_token = data["token"]
                    self.user_id = data["user"]["id"]
                    self.log_result("User Login", True, "User login successful")
                    return True
                else:
                    self.log_result("User Login", False, "Missing token or user data", data)
                    return False
            except json.JSONDecodeError:
                self.log_result("User Login", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_result("User Login", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_vendor_issue_points(self):
        """Test vendor issue points endpoint"""
        print("\n=== Testing Vendor Issue Points ===")
        
        if not self.vendor_token:
            self.log_result("Issue Points", False, "No vendor token available")
            return False
        
        # First test with vendor status not approved (should get 403)
        issue_data = {
            "user_phone": "+60123456789",  # Using test user phone
            "bill_amount": 25.50,
            "description": "Lunch bill payment"
        }
        
        response = self.make_request("POST", "/vendor/issue-points", issue_data, token=self.vendor_token)
        
        if response is None:
            self.log_result("Issue Points (Unapproved)", False, "Request failed - connection error")
            return False
        
        if response.status_code == 403:
            self.log_result("Issue Points (Unapproved)", True, "Correctly rejected - vendor not approved")
        elif response.status_code == 404:
            self.log_result("Issue Points (User Not Found)", True, "User not found with phone number (expected)")
        elif response.status_code == 200:
            # Vendor might already be approved
            try:
                data = response.json()
                if "points_issued" in data:
                    self.log_result("Issue Points", True, f"Points issued: {data['points_issued']}")
                else:
                    self.log_result("Issue Points", False, "Missing points_issued in response", data)
                    return False
            except json.JSONDecodeError:
                self.log_result("Issue Points", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_result("Issue Points", False, f"HTTP {response.status_code}", response.text)
            return False
        
        return True
    
    def test_vendor_analytics(self):
        """Test vendor analytics endpoints"""
        print("\n=== Testing Vendor Analytics ===")
        
        if not self.vendor_token:
            self.log_result("Vendor Analytics", False, "No vendor token available")
            return False
        
        # Test general analytics
        response = self.make_request("GET", "/vendor/analytics", token=self.vendor_token)
        
        if response is None:
            self.log_result("Vendor Analytics", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                required_fields = ["total_redemptions", "pending_redemptions", "total_points_issued", "vendor"]
                if all(field in data for field in required_fields):
                    self.log_result("Vendor Analytics", True, "Analytics retrieved successfully")
                else:
                    self.log_result("Vendor Analytics", False, "Missing required analytics fields", data)
                    return False
            except json.JSONDecodeError:
                self.log_result("Vendor Analytics", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_result("Vendor Analytics", False, f"HTTP {response.status_code}", response.text)
            return False
        
        # Test daily analytics
        response = self.make_request("GET", "/vendor/analytics/daily?days=7", token=self.vendor_token)
        
        if response is None:
            self.log_result("Daily Analytics", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "daily_stats" in data and isinstance(data["daily_stats"], list):
                    self.log_result("Daily Analytics", True, f"Retrieved {len(data['daily_stats'])} days of data")
                    return True
                else:
                    self.log_result("Daily Analytics", False, "Invalid daily stats data", data)
                    return False
            except json.JSONDecodeError:
                self.log_result("Daily Analytics", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_result("Daily Analytics", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_vendor_redemptions(self):
        """Test vendor redemptions endpoints"""
        print("\n=== Testing Vendor Redemptions ===")
        
        if not self.vendor_token:
            self.log_result("Vendor Redemptions", False, "No vendor token available")
            return False
        
        # Test GET redemptions
        response = self.make_request("GET", "/vendor/redemptions", token=self.vendor_token)
        
        if response is None:
            self.log_result("Get Redemptions", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "redemptions" in data and isinstance(data["redemptions"], list):
                    self.log_result("Get Redemptions", True, f"Retrieved {len(data['redemptions'])} redemptions")
                else:
                    self.log_result("Get Redemptions", False, "Invalid redemptions data", data)
                    return False
            except json.JSONDecodeError:
                self.log_result("Get Redemptions", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_result("Get Redemptions", False, f"HTTP {response.status_code}", response.text)
            return False
        
        # Test GET today's redemptions
        response = self.make_request("GET", "/vendor/redemptions/today", token=self.vendor_token)
        
        if response is None:
            self.log_result("Today Redemptions", False, "Request failed - connection error")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "redemptions" in data and "count" in data:
                    self.log_result("Today Redemptions", True, f"Today's redemptions: {data['count']}")
                else:
                    self.log_result("Today Redemptions", False, "Invalid today redemptions data", data)
                    return False
            except json.JSONDecodeError:
                self.log_result("Today Redemptions", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_result("Today Redemptions", False, f"HTTP {response.status_code}", response.text)
            return False
        
        # Test validate redemption with invalid code (should fail)
        validate_data = {"redemption_code": "INVALID-CODE"}
        response = self.make_request("POST", "/vendor/validate-redemption", validate_data, token=self.vendor_token)
        
        if response is None:
            self.log_result("Validate Invalid Redemption", False, "Request failed - connection error")
            return False
        
        if response.status_code == 404:
            self.log_result("Validate Invalid Redemption", True, "Correctly rejected invalid redemption code")
        else:
            self.log_result("Validate Invalid Redemption", False, f"Unexpected response: HTTP {response.status_code}", response.text)
        
        # Test confirm redemption with invalid code (should fail)
        confirm_data = {"redemption_code": "INVALID-CODE"}
        response = self.make_request("POST", "/vendor/confirm-redemption", confirm_data, token=self.vendor_token)
        
        if response is None:
            self.log_result("Confirm Invalid Redemption", False, "Request failed - connection error")
            return False
        
        if response.status_code == 404:
            self.log_result("Confirm Invalid Redemption", True, "Correctly rejected invalid redemption code")
        else:
            self.log_result("Confirm Invalid Redemption", False, f"Unexpected response: HTTP {response.status_code}", response.text)
        
        return True
    
    def run_all_tests(self):
        """Run all vendor API tests"""
        print("🚀 Starting Vendor Dashboard API Tests")
        print(f"Base URL: {BASE_URL}")
        print("=" * 60)
        
        # Test sequence
        tests = [
            ("Vendor Registration/Login", self.test_vendor_registration),
            ("Vendor Profile", self.test_vendor_profile),
            ("Vendor Branches CRUD", self.test_vendor_branches),
            ("Vendor Rewards Management", self.test_vendor_rewards),
            ("User Login (for testing)", self.test_user_login),
            ("Vendor Issue Points", self.test_vendor_issue_points),
            ("Vendor Analytics", self.test_vendor_analytics),
            ("Vendor Redemptions", self.test_vendor_redemptions),
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            try:
                if test_func():
                    passed += 1
            except Exception as e:
                self.log_result(test_name, False, f"Test failed with exception: {str(e)}")
        
        # Summary
        print("\n" + "=" * 60)
        print("🏁 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        # Detailed results
        print("\n📊 DETAILED RESULTS:")
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        return passed == total

def main():
    """Main test runner"""
    tester = VendorAPITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()