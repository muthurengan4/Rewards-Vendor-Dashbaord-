#!/usr/bin/env python3
"""
Test vendor issue points functionality after approving vendor status
"""

import requests
import json
from datetime import datetime
import os
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

# Configuration
BASE_URL = "https://point-vault.preview.emergentagent.com/api"
TEST_VENDOR_EMAIL = "testvendor@test.com"
TEST_VENDOR_PASSWORD = "vendor123"
TEST_USER_EMAIL = "mobile@test.com"
TEST_USER_PASSWORD = "test1234"

async def update_vendor_status():
    """Update vendor status to approved in database"""
    try:
        # Connect to MongoDB
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        client = AsyncIOMotorClient(mongo_url)
        db = client[os.environ.get('DB_NAME', 'rewardshub')]
        
        # Update vendor status to approved
        result = await db.vendors.update_one(
            {"email": TEST_VENDOR_EMAIL},
            {"$set": {"status": "approved", "is_active": True}}
        )
        
        if result.modified_count > 0:
            print("✅ Vendor status updated to 'approved'")
            return True
        else:
            print("❌ Failed to update vendor status")
            return False
            
    except Exception as e:
        print(f"❌ Database error: {str(e)}")
        return False
    finally:
        client.close()

def test_issue_points_approved():
    """Test issue points with approved vendor"""
    print("\n=== Testing Issue Points with Approved Vendor ===")
    
    # Login vendor
    login_data = {
        "email": TEST_VENDOR_EMAIL,
        "password": TEST_VENDOR_PASSWORD
    }
    
    response = requests.post(f"{BASE_URL}/vendor/login", json=login_data, timeout=30)
    
    if response.status_code != 200:
        print(f"❌ Vendor login failed: {response.status_code}")
        return False
    
    vendor_data = response.json()
    vendor_token = vendor_data["token"]
    
    # Login user to get phone number
    user_login_data = {
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    }
    
    response = requests.post(f"{BASE_URL}/auth/login", json=user_login_data, timeout=30)
    
    if response.status_code != 200:
        print(f"❌ User login failed: {response.status_code}")
        return False
    
    user_data = response.json()
    user_phone = user_data["user"].get("phone", "+60123456789")  # fallback phone
    
    # Test issue points
    issue_data = {
        "user_phone": user_phone,
        "bill_amount": 25.50,
        "description": "Test bill payment after approval"
    }
    
    headers = {
        "Authorization": f"Bearer {vendor_token}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(f"{BASE_URL}/vendor/issue-points", json=issue_data, headers=headers, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Points issued successfully: {data.get('points_issued', 0)} points")
        print(f"   User: {data.get('user_name', 'Unknown')}")
        print(f"   New Balance: {data.get('new_balance', 0)}")
        return True
    elif response.status_code == 404:
        print(f"❌ User not found with phone: {user_phone}")
        return False
    else:
        print(f"❌ Issue points failed: {response.status_code} - {response.text}")
        return False

async def main():
    """Main test function"""
    print("🚀 Testing Vendor Issue Points with Approval")
    print("=" * 50)
    
    # Update vendor status
    if await update_vendor_status():
        # Test issue points
        if test_issue_points_approved():
            print("\n🎉 Issue points test passed!")
        else:
            print("\n💥 Issue points test failed!")
    else:
        print("\n💥 Failed to update vendor status!")

if __name__ == "__main__":
    asyncio.run(main())