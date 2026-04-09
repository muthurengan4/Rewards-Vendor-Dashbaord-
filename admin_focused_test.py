#!/usr/bin/env python3
"""
Focused Admin Panel Backend API Testing - Key Endpoints Only
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
USER_EMAIL = "mobile@test.com"
USER_PASSWORD = "test1234"

def test_admin_authentication():
    """Test admin authentication endpoints"""
    print("🔐 Testing Admin Authentication...")
    
    # Test valid login
    try:
        response = requests.post(f"{BASE_URL}/admin/login", 
                               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                               timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "token" in data and "admin" in data:
                if "password_hash" not in data["admin"]:
                    print("✅ Admin Login: SUCCESS - No password hash exposed")
                    admin_token = data["token"]
                else:
                    print("❌ Admin Login: FAIL - Password hash exposed")
                    return None
            else:
                print("❌ Admin Login: FAIL - Missing token or admin")
                return None
        else:
            print(f"❌ Admin Login: FAIL - Status {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Admin Login: FAIL - {e}")
        return None
    
    # Test invalid login
    try:
        response = requests.post(f"{BASE_URL}/admin/login", 
                               json={"email": ADMIN_EMAIL, "password": "wrongpassword"},
                               timeout=10)
        if response.status_code == 401:
            print("✅ Admin Invalid Login: SUCCESS - Correctly rejected")
        else:
            print(f"❌ Admin Invalid Login: FAIL - Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"❌ Admin Invalid Login: FAIL - {e}")
    
    # Test admin/me endpoint
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/admin/me", headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "password_hash" not in data:
                print("✅ Admin Profile: SUCCESS - No password hash exposed")
            else:
                print("❌ Admin Profile: FAIL - Password hash exposed")
        else:
            print(f"❌ Admin Profile: FAIL - Status {response.status_code}")
    except Exception as e:
        print(f"❌ Admin Profile: FAIL - {e}")
    
    # Test admin endpoint without token
    try:
        response = requests.get(f"{BASE_URL}/admin/me", timeout=10)
        if response.status_code in [401, 403]:
            print("✅ Admin No Token: SUCCESS - Correctly rejected")
        else:
            print(f"❌ Admin No Token: FAIL - Expected 401/403, got {response.status_code}")
    except Exception as e:
        print(f"❌ Admin No Token: FAIL - {e}")
    
    # Test admin endpoint with user token
    try:
        user_response = requests.post(f"{BASE_URL}/auth/login", 
                                    json={"email": USER_EMAIL, "password": USER_PASSWORD},
                                    timeout=10)
        if user_response.status_code == 200:
            user_token = user_response.json().get("token")
            headers = {"Authorization": f"Bearer {user_token}"}
            response = requests.get(f"{BASE_URL}/admin/me", headers=headers, timeout=10)
            if response.status_code in [401, 403]:
                print("✅ Admin User Token: SUCCESS - Correctly rejected user token")
            else:
                print(f"❌ Admin User Token: FAIL - Expected 401/403, got {response.status_code}")
        else:
            print("❌ Admin User Token: FAIL - Could not get user token")
    except Exception as e:
        print(f"❌ Admin User Token: FAIL - {e}")
    
    return admin_token

def test_admin_dashboard(admin_token):
    """Test admin dashboard endpoint"""
    print("\n📊 Testing Admin Dashboard...")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/admin/dashboard", headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            required_fields = ["total_users", "total_vendors", "total_categories", "total_rewards",
                             "points_issued", "points_redeemed", "points_balance", "activity_feed", "top_vendors"]
            missing_fields = [field for field in required_fields if field not in data]
            if not missing_fields:
                print(f"✅ Admin Dashboard: SUCCESS - Users: {data['total_users']}, Vendors: {data['total_vendors']}, Points: {data['points_balance']}")
            else:
                print(f"❌ Admin Dashboard: FAIL - Missing fields: {missing_fields}")
        else:
            print(f"❌ Admin Dashboard: FAIL - Status {response.status_code}")
    except Exception as e:
        print(f"❌ Admin Dashboard: FAIL - {e}")

def test_admin_user_management(admin_token):
    """Test admin user management endpoints"""
    print("\n👥 Testing Admin User Management...")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # List users
        response = requests.get(f"{BASE_URL}/admin/users", headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "users" in data and len(data["users"]) > 0:
                print(f"✅ List Users: SUCCESS - Found {len(data['users'])} users")
                test_user = data["users"][0]
                user_id = test_user["id"]
                
                # Get user details
                response = requests.get(f"{BASE_URL}/admin/users/{user_id}", headers=headers, timeout=10)
                if response.status_code == 200:
                    user_data = response.json()
                    if "password_hash" not in user_data:
                        print(f"✅ Get User: SUCCESS - {user_data['name']} ({user_data['email']})")
                    else:
                        print("❌ Get User: FAIL - Password hash exposed")
                else:
                    print(f"❌ Get User: FAIL - Status {response.status_code}")
                
                # Test block/unblock
                block_response = requests.post(f"{BASE_URL}/admin/users/{user_id}/block", headers=headers, timeout=10)
                unblock_response = requests.post(f"{BASE_URL}/admin/users/{user_id}/unblock", headers=headers, timeout=10)
                if block_response.status_code == 200 and unblock_response.status_code == 200:
                    print("✅ Block/Unblock User: SUCCESS")
                else:
                    print("❌ Block/Unblock User: FAIL")
                
                # Test adjust points
                adjust_response = requests.post(f"{BASE_URL}/admin/users/{user_id}/adjust-points", 
                                              headers=headers, 
                                              json={"amount": 10, "reason": "Test adjustment"},
                                              timeout=10)
                if adjust_response.status_code == 200:
                    print("✅ Adjust Points: SUCCESS")
                else:
                    print("❌ Adjust Points: FAIL")
            else:
                print("❌ List Users: FAIL - No users found")
        else:
            print(f"❌ List Users: FAIL - Status {response.status_code}")
    except Exception as e:
        print(f"❌ User Management: FAIL - {e}")

def test_admin_vendor_management(admin_token):
    """Test admin vendor management endpoints"""
    print("\n🏪 Testing Admin Vendor Management...")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # List vendors
        response = requests.get(f"{BASE_URL}/admin/vendors", headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "vendors" in data and len(data["vendors"]) > 0:
                print(f"✅ List Vendors: SUCCESS - Found {len(data['vendors'])} vendors")
                test_vendor = data["vendors"][0]
                vendor_id = test_vendor["id"]
                
                # Get vendor details
                response = requests.get(f"{BASE_URL}/admin/vendors/{vendor_id}", headers=headers, timeout=10)
                if response.status_code == 200:
                    vendor_data = response.json()
                    if "password_hash" not in vendor_data:
                        print(f"✅ Get Vendor: SUCCESS - {vendor_data['store_name']} ({vendor_data['email']})")
                    else:
                        print("❌ Get Vendor: FAIL - Password hash exposed")
                else:
                    print(f"❌ Get Vendor: FAIL - Status {response.status_code}")
                
                # Test vendor status management
                approve_response = requests.post(f"{BASE_URL}/admin/vendors/{vendor_id}/approve", headers=headers, timeout=10)
                suspend_response = requests.post(f"{BASE_URL}/admin/vendors/{vendor_id}/suspend", headers=headers, timeout=10)
                activate_response = requests.post(f"{BASE_URL}/admin/vendors/{vendor_id}/activate", headers=headers, timeout=10)
                
                if all(r.status_code == 200 for r in [approve_response, suspend_response, activate_response]):
                    print("✅ Vendor Status Management: SUCCESS")
                else:
                    print("❌ Vendor Status Management: FAIL")
            else:
                print("❌ List Vendors: FAIL - No vendors found")
        else:
            print(f"❌ List Vendors: FAIL - Status {response.status_code}")
    except Exception as e:
        print(f"❌ Vendor Management: FAIL - {e}")

def test_admin_category_management(admin_token):
    """Test admin category management endpoints"""
    print("\n📂 Testing Admin Category Management...")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # List categories
        response = requests.get(f"{BASE_URL}/admin/categories", headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "categories" in data:
                print(f"✅ List Categories: SUCCESS - Found {len(data['categories'])} categories")
                
                # Create category
                test_category = {
                    "name": f"Test Category {datetime.now().strftime('%H%M%S')}",
                    "icon": "test",
                    "description": "Test category"
                }
                create_response = requests.post(f"{BASE_URL}/admin/categories", 
                                              headers=headers, 
                                              json=test_category,
                                              timeout=10)
                if create_response.status_code == 200:
                    created_data = create_response.json()
                    category_id = created_data["category"]["id"]
                    print("✅ Create Category: SUCCESS")
                    
                    # Update category
                    update_response = requests.put(f"{BASE_URL}/admin/categories/{category_id}", 
                                                 headers=headers, 
                                                 json={"description": "Updated description"},
                                                 timeout=10)
                    if update_response.status_code == 200:
                        print("✅ Update Category: SUCCESS")
                    else:
                        print("❌ Update Category: FAIL")
                    
                    # Delete category
                    delete_response = requests.delete(f"{BASE_URL}/admin/categories/{category_id}", 
                                                    headers=headers, 
                                                    timeout=10)
                    if delete_response.status_code == 200:
                        print("✅ Delete Category: SUCCESS")
                    else:
                        print("❌ Delete Category: FAIL")
                else:
                    print("❌ Create Category: FAIL")
            else:
                print("❌ List Categories: FAIL - No categories field")
        else:
            print(f"❌ List Categories: FAIL - Status {response.status_code}")
    except Exception as e:
        print(f"❌ Category Management: FAIL - {e}")

def main():
    """Main test execution"""
    print("🚀 Admin Panel Backend API Tests")
    print(f"Testing against: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    # Test authentication
    admin_token = test_admin_authentication()
    if not admin_token:
        print("❌ Cannot proceed without admin token")
        return False
    
    # Test other endpoints
    test_admin_dashboard(admin_token)
    test_admin_user_management(admin_token)
    test_admin_vendor_management(admin_token)
    test_admin_category_management(admin_token)
    
    print("\n✅ Admin Panel Backend Testing Complete!")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)