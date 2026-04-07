#!/usr/bin/env python3
"""
Test vendor redemption validation and confirmation flow with proper setup
"""

import requests
import json

# Configuration
BASE_URL = "https://point-vault.preview.emergentagent.com/api"
TEST_VENDOR_EMAIL = "testvendor@test.com"
TEST_VENDOR_PASSWORD = "vendor123"
TEST_USER_EMAIL = "ahmad@test.my"
TEST_USER_PASSWORD = "test1234"

def test_redemption_flow():
    """Test complete redemption flow"""
    print("🚀 Testing Vendor Redemption Flow")
    print("=" * 40)
    
    # 1. Login vendor
    print("\n=== Step 1: Vendor Login ===")
    vendor_login = {
        "email": TEST_VENDOR_EMAIL,
        "password": TEST_VENDOR_PASSWORD
    }
    
    response = requests.post(f"{BASE_URL}/vendor/login", json=vendor_login, timeout=30)
    if response.status_code != 200:
        print(f"❌ Vendor login failed: {response.status_code}")
        return False
    
    vendor_data = response.json()
    vendor_token = vendor_data["token"]
    print("✅ Vendor logged in successfully")
    
    # 2. Create a new active reward for testing
    print("\n=== Step 2: Create Active Reward ===")
    headers = {"Authorization": f"Bearer {vendor_token}"}
    reward_data = {
        "name": "Test Free Coffee",
        "description": "Free coffee for testing redemption",
        "points_required": 50,
        "reward_type": "free_item",
        "value": 5.0,
        "terms_conditions": "Valid for testing only",
        "quantity": 10
    }
    
    response = requests.post(f"{BASE_URL}/vendor/rewards", json=reward_data, headers=headers, timeout=30)
    if response.status_code not in [200, 201]:
        print(f"❌ Failed to create reward: {response.status_code}")
        return False
    
    reward_response = response.json()
    reward_id = reward_response["reward"]["id"]
    reward_name = reward_response["reward"]["name"]
    print(f"✅ Created active reward: {reward_name} (ID: {reward_id})")
    
    # 3. Login user
    print("\n=== Step 3: User Login ===")
    user_login = {
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    }
    
    response = requests.post(f"{BASE_URL}/auth/login", json=user_login, timeout=30)
    if response.status_code != 200:
        print(f"❌ User login failed: {response.status_code}")
        return False
    
    user_data = response.json()
    user_token = user_data["token"]
    user_balance = user_data["user"]["points_balance"]
    print(f"✅ User logged in successfully (Balance: {user_balance} points)")
    
    # Check if user has enough points
    if user_balance < 50:
        print("⚠️  User doesn't have enough points, adding demo points...")
        user_headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.post(f"{BASE_URL}/earn/demo", headers=user_headers, timeout=30)
        if response.status_code == 200:
            demo_data = response.json()
            print(f"✅ Added demo points: {demo_data.get('new_balance', 0)}")
        else:
            print(f"❌ Failed to add demo points: {response.status_code}")
    
    # 4. User redeems reward
    print("\n=== Step 4: User Redeems Reward ===")
    user_headers = {"Authorization": f"Bearer {user_token}"}
    
    response = requests.post(f"{BASE_URL}/redeem-at-vendor?reward_id={reward_id}", headers=user_headers, timeout=30)
    
    if response.status_code != 200:
        print(f"❌ Redemption failed: {response.status_code} - {response.text}")
        return False
    
    redemption_data = response.json()
    redemption_code = redemption_data["redemption"]["redemption_code"]
    print(f"✅ Redemption successful! Code: {redemption_code}")
    
    # 5. Vendor validates redemption
    print("\n=== Step 5: Vendor Validates Redemption ===")
    validate_data = {"redemption_code": redemption_code}
    
    response = requests.post(f"{BASE_URL}/vendor/validate-redemption", json=validate_data, headers=headers, timeout=30)
    
    if response.status_code != 200:
        print(f"❌ Validation failed: {response.status_code} - {response.text}")
        return False
    
    validation_data = response.json()
    print(f"✅ Redemption validated successfully")
    print(f"   Valid: {validation_data.get('valid', False)}")
    print(f"   User: {validation_data.get('user', {}).get('name', 'Unknown')}")
    
    # 6. Vendor confirms redemption
    print("\n=== Step 6: Vendor Confirms Redemption ===")
    confirm_data = {"redemption_code": redemption_code}
    
    response = requests.post(f"{BASE_URL}/vendor/confirm-redemption", json=confirm_data, headers=headers, timeout=30)
    
    if response.status_code != 200:
        print(f"❌ Confirmation failed: {response.status_code} - {response.text}")
        return False
    
    confirm_data = response.json()
    print(f"✅ Redemption confirmed successfully")
    print(f"   Message: {confirm_data.get('message', 'No message')}")
    
    # 7. Try to validate same code again (should fail)
    print("\n=== Step 7: Try to Validate Used Code ===")
    validate_data = {"redemption_code": redemption_code}
    
    response = requests.post(f"{BASE_URL}/vendor/validate-redemption", json=validate_data, headers=headers, timeout=30)
    
    if response.status_code == 400:
        print("✅ Correctly rejected already used redemption code")
    else:
        print(f"❌ Unexpected response for used code: {response.status_code}")
        return False
    
    # 8. Check vendor redemptions
    print("\n=== Step 8: Check Vendor Redemptions ===")
    response = requests.get(f"{BASE_URL}/vendor/redemptions", headers=headers, timeout=30)
    
    if response.status_code != 200:
        print(f"❌ Failed to get redemptions: {response.status_code}")
        return False
    
    redemptions_data = response.json()
    redemptions = redemptions_data.get("redemptions", [])
    print(f"✅ Retrieved {len(redemptions)} redemptions")
    
    # Find our redemption
    our_redemption = None
    for r in redemptions:
        if r.get("redemption_code") == redemption_code:
            our_redemption = r
            break
    
    if our_redemption:
        print(f"   Found our redemption: Status = {our_redemption.get('status', 'unknown')}")
    else:
        print("   Our redemption not found in list")
    
    # 9. Test today's redemptions
    print("\n=== Step 9: Check Today's Redemptions ===")
    response = requests.get(f"{BASE_URL}/vendor/redemptions/today", headers=headers, timeout=30)
    
    if response.status_code != 200:
        print(f"❌ Failed to get today's redemptions: {response.status_code}")
        return False
    
    today_data = response.json()
    print(f"✅ Today's redemptions: {today_data.get('count', 0)}")
    
    return True

def main():
    """Main test function"""
    if test_redemption_flow():
        print("\n🎉 Complete redemption flow test passed!")
    else:
        print("\n💥 Redemption flow test failed!")

if __name__ == "__main__":
    main()