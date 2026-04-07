#!/usr/bin/env python3
"""
Test vendor issue points with manual database update
"""

import requests
import json
import subprocess
import sys

# Configuration
BASE_URL = "https://point-vault.preview.emergentagent.com/api"
TEST_VENDOR_EMAIL = "testvendor@test.com"
TEST_VENDOR_PASSWORD = "vendor123"

def update_vendor_status_mongo():
    """Update vendor status using MongoDB CLI"""
    try:
        # MongoDB command to update vendor status
        mongo_cmd = [
            "mongosh", 
            "mongodb://localhost:27017/test_database",
            "--eval",
            f'db.vendors.updateOne({{"email": "{TEST_VENDOR_EMAIL}"}}, {{"$set": {{"status": "approved", "is_active": true}}}})'
        ]
        
        result = subprocess.run(mongo_cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print("✅ Vendor status updated to 'approved' via MongoDB CLI")
            return True
        else:
            print(f"❌ MongoDB update failed: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ MongoDB command timed out")
        return False
    except Exception as e:
        print(f"❌ Error updating vendor status: {str(e)}")
        return False

def test_issue_points_with_existing_user():
    """Test issue points with existing user phone"""
    print("\n=== Testing Issue Points with Approved Vendor ===")
    
    # Login vendor
    login_data = {
        "email": TEST_VENDOR_EMAIL,
        "password": TEST_VENDOR_PASSWORD
    }
    
    try:
        response = requests.post(f"{BASE_URL}/vendor/login", json=login_data, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ Vendor login failed: {response.status_code}")
            return False
        
        vendor_data = response.json()
        vendor_token = vendor_data["token"]
        
        # Test issue points with a phone number that should exist
        # Using the phone from test credentials
        issue_data = {
            "user_phone": "+60123456789",  # Common test phone
            "bill_amount": 25.50,
            "description": "Test bill payment after approval"
        }
        
        headers = {
            "Authorization": f"Bearer {vendor_token}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(f"{BASE_URL}/vendor/issue-points", json=issue_data, headers=headers, timeout=30)
        
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Points issued successfully: {data.get('points_issued', 0)} points")
            print(f"   User: {data.get('user_name', 'Unknown')}")
            print(f"   New Balance: {data.get('new_balance', 0)}")
            return True
        elif response.status_code == 403:
            print("❌ Vendor still not approved (403 Forbidden)")
            return False
        elif response.status_code == 404:
            print(f"❌ User not found with phone: +60123456789")
            return False
        else:
            print(f"❌ Issue points failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Request error: {str(e)}")
        return False

def main():
    """Main test function"""
    print("🚀 Testing Vendor Issue Points with Manual Approval")
    print("=" * 55)
    
    # Try to update vendor status
    if update_vendor_status_mongo():
        # Test issue points
        if test_issue_points_with_existing_user():
            print("\n🎉 Issue points test passed!")
        else:
            print("\n💥 Issue points test failed!")
    else:
        print("\n⚠️  Could not update vendor status, testing anyway...")
        # Test anyway to see current behavior
        test_issue_points_with_existing_user()

if __name__ == "__main__":
    main()