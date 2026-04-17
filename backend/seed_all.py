"""
3ARewards - Database Seed Script
Runs all seeds: vendors, branches, categories (3D icons), and bill types.

Usage: python3 seed_all.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import uuid, os, bcrypt
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

def hash_pw(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

ICON_BASE = "https://icons.iconarchive.com/icons/microsoft/fluentui-emoji-3d/256"

# ============ CATEGORY 3D IMAGES ============
CATEGORY_IMAGES = {
    "Coffee": f"{ICON_BASE}/Hot-Beverage-3d-icon.png",
    "Fuel": f"{ICON_BASE}/Fuel-Pump-3d-icon.png",
    "Grocery": f"{ICON_BASE}/Shopping-Cart-3d-icon.png",
    "Health & Beauty": f"{ICON_BASE}/Red-Heart-3d-icon.png",
    "Malaysian Food": f"{ICON_BASE}/Cooking-3d-icon.png",
    "Transport": f"{ICON_BASE}/Bus-3d-icon.png",
    "Travel": f"{ICON_BASE}/Airplane-3d-icon.png",
    "Dining": f"{ICON_BASE}/Cooking-3d-icon.png",
}

# ============ BILL TYPES ============
BILL_TYPES = [
    {"name": "Electricity (TNB)", "icon": "flash", "image": f"{ICON_BASE}/High-Voltage-3d-icon.png", "provider": "Tenaga Nasional Berhad", "bg_color": "#FEF3C7", "sort_order": 1},
    {"name": "Water Bill", "icon": "water", "image": f"{ICON_BASE}/Droplet-3d-icon.png", "provider": "Air Selangor / SYABAS", "bg_color": "#DBEAFE", "sort_order": 2},
    {"name": "Phone Bill", "icon": "call", "image": f"{ICON_BASE}/Telephone-Receiver-3d-icon.png", "provider": "Maxis / Digi / Celcom / U Mobile", "bg_color": "#DCFCE7", "sort_order": 3},
    {"name": "Internet / WiFi", "icon": "wifi", "image": f"{ICON_BASE}/Satellite-Antenna-3d-icon.png", "provider": "TM / Maxis / Time", "bg_color": "#FCE7F3", "sort_order": 4},
    {"name": "Astro TV", "icon": "tv", "image": f"{ICON_BASE}/Television-3d-icon.png", "provider": "Astro Malaysia", "bg_color": "#F3E8FF", "sort_order": 5},
    {"name": "Fuel (Petrol)", "icon": "car", "image": f"{ICON_BASE}/Fuel-Pump-3d-icon.png", "provider": "Petronas / Shell / Petron", "bg_color": "#FEE2E2", "sort_order": 6},
    {"name": "House Rent", "icon": "home", "image": f"{ICON_BASE}/House-3d-icon.png", "provider": "Property Owner", "bg_color": "#FCE7F3", "sort_order": 7},
    {"name": "Insurance", "icon": "shield-checkmark", "image": f"{ICON_BASE}/Shield-3d-icon.png", "provider": "Various Providers", "bg_color": "#DCFCE7", "sort_order": 8},
]

# ============ VENDORS & BRANCHES ============
VENDORS = [
    {
        "store_name": "Giant",
        "category": "Grocery",
        "email": "giant@vendor.my",
        "password": "vendor123",
        "phone": "+60312345001",
        "image": "https://images.unsplash.com/photo-1725075436099-9942d133f305?w=400&h=300&fit=crop",
        "description": "Giant Hypermarket - Malaysia's leading supermarket chain",
        "branches": [
            {"name": "Giant Ampang Point", "address": "36 Ampang Point Shopping Centre, Jalan Mamanda 3, Taman Dato Ahmad Razali, 68000 Ampang, Selangor", "operating_hours": "08:00 - 20:00", "lat": 3.157807, "lng": 101.7509522},
            {"name": "Giant Bandar Kinrara", "address": "Spectrum Shopping Mall, Jalan Wawasan 4/2, Bandar Baru Ampang, 68000 Ampang, Selangor", "operating_hours": "08:00 - 20:00", "lat": 3.0459676, "lng": 101.6462933},
            {"name": "Giant Bayan Baru", "address": "78, Jalan Tengah, 11900 Bayan Lepas, Pulau Pinang", "operating_hours": "08:00 - 20:00", "lat": 5.3200458, "lng": 100.2851905},
        ]
    },
    {
        "store_name": "Mercato",
        "category": "Grocery",
        "email": "mercato@vendor.my",
        "password": "vendor123",
        "phone": "+60312345002",
        "image": "https://images.unsplash.com/photo-1760463921658-0fa0ce72c91c?w=400&h=300&fit=crop",
        "description": "Mercato - Premium grocery & fresh market experience",
        "branches": [
            {"name": "Mercato The Exchange TRX", "address": "Unit C.AT.2, Concourse Level, Plaza The Exchange TRX, Persiaran TRX, Imbi, 55188 Kuala Lumpur", "operating_hours": "08:00 - 20:00", "lat": 3.1416197, "lng": 101.7189213},
            {"name": "Mercato Sunway Putra Mall", "address": "LG-1, Lower Ground Floor, Sunway Putra Mall, 100 Putra Place, 50350 Kuala Lumpur", "operating_hours": "08:00 - 20:00", "lat": 3.1663944, "lng": 101.6923863},
            {"name": "Mercato Solaris Mont Kiara", "address": "Lot L-0-1, Solaris Mont Kiara, Jalan Solaris, Mont Kiara, 50480 Kuala Lumpur", "operating_hours": "08:00 - 20:00", "lat": 3.175139, "lng": 101.6601045},
        ]
    },
    {
        "store_name": "Cold Storage",
        "category": "Grocery",
        "email": "coldstorage@vendor.my",
        "password": "vendor123",
        "phone": "+60312345003",
        "image": "https://images.unsplash.com/photo-1760463921658-0fa0ce72c91c?w=400&h=300&fit=crop",
        "description": "Cold Storage - Premium supermarket for quality products",
        "branches": [
            {"name": "Cold Storage - Suria KLCC", "address": "Suria KLCC, Jln Ampang, Kuala Lumpur City Centre, 50450 Kuala Lumpur", "operating_hours": "08:00 - 20:00", "lat": 3.1567898, "lng": 101.7121307},
            {"name": "Cold Storage Sungei Wang", "address": "LB Floor, Sungei Wang Plaza, Jln Sultan Ismail, Pudu, 55100 Kuala Lumpur", "operating_hours": "08:00 - 20:00", "lat": 3.1446053, "lng": 101.7109734},
        ]
    },
    {
        "store_name": "KFC",
        "category": "Dining",
        "email": "kfc@vendor.my",
        "password": "vendor123",
        "phone": "+60312345004",
        "image": "https://images.unsplash.com/photo-1709697420361-7a11b5f5f495?w=400&h=300&fit=crop",
        "description": "KFC - Kentucky Fried Chicken Malaysia",
        "branches": [
            {"name": "KFC Gamuda Garden", "address": "Unit C-GF-05, Ground Floor, Garden Square, Bandar Gamuda Garden, 48050 Rawang, Selangor", "operating_hours": "08:00 - 20:00", "lat": 3.3194651, "lng": 101.5747699},
            {"name": "KFC Sri Damansara", "address": "G3-A & G5, Bangunan Menara Amanah Ikhtiar, Bandar Sri Damansara, 52200 Kuala Lumpur", "operating_hours": "08:00 - 20:00", "lat": 3.2075754, "lng": 101.6285855},
        ]
    },
    {
        "store_name": "Pizza Hut",
        "category": "Dining",
        "email": "pizzahut@vendor.my",
        "password": "vendor123",
        "phone": "+60312345005",
        "image": "https://images.unsplash.com/photo-1763992108632-77121f308b43?w=400&h=300&fit=crop",
        "description": "Pizza Hut - World's favourite pizza chain",
        "branches": [
            {"name": "Pizza Hut Pavilion KL", "address": "Level 1, Pavilion KL, 168 Bukit Bintang Rd, 55100 Kuala Lumpur", "operating_hours": "08:00 - 20:00", "lat": 3.149154, "lng": 101.7129531},
            {"name": "Pizza Hut Avenue K", "address": "UC-1, Avenue K, Jln Ampang, 50450 Kuala Lumpur", "operating_hours": "08:00 - 20:00", "lat": 3.1594534, "lng": 101.7135977},
        ]
    },
    {
        "store_name": "Petron",
        "category": "Fuel",
        "email": "petron@vendor.my",
        "password": "vendor123",
        "phone": "+60312345006",
        "image": "https://images.unsplash.com/photo-1671526402719-fe212921d42c?w=400&h=300&fit=crop",
        "description": "Petron Malaysia - Quality fuel and services",
        "branches": [
            {"name": "Petron Jalan Tun Razak", "address": "203A, Jln Tun Razak, 50400 Kuala Lumpur", "operating_hours": "Open 24 Hours", "lat": 3.1648644, "lng": 101.7156753},
            {"name": "Petron Bukit Damansara", "address": "P1, Menara I&P, 46 Jalan Dungun, Bukit Damansara, 50490 Kuala Lumpur", "operating_hours": "Open 24 Hours", "lat": 3.1523954, "lng": 101.6584455},
        ]
    },
]


async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    print(f"Connected to {MONGO_URL} / {DB_NAME}")

    # ===== 1. SEED CATEGORIES 3D IMAGES =====
    print("\n--- Updating Category 3D Images ---")
    updated = 0
    for name, img in CATEGORY_IMAGES.items():
        result = await db.categories.update_many({"name": name}, {"$set": {"image": img}})
        if result.modified_count > 0:
            updated += result.modified_count
            print(f"  Updated: {name}")
    print(f"  Total: {updated} categories updated")

    # ===== 2. SEED BILL TYPES =====
    print("\n--- Seeding Bill Types ---")
    await db.bill_types.delete_many({})
    for bt in BILL_TYPES:
        bt["id"] = str(uuid.uuid4())
        bt["is_active"] = True
        bt["created_at"] = datetime.utcnow()
    await db.bill_types.insert_many(BILL_TYPES)
    print(f"  Seeded {len(BILL_TYPES)} bill types")

    # ===== 3. SEED VENDORS & BRANCHES =====
    print("\n--- Seeding Vendors & Branches ---")
    del_v = await db.vendors.delete_many({})
    del_p = await db.partners.delete_many({})
    del_b = await db.branches.delete_many({})
    print(f"  Cleared: {del_v.deleted_count} vendors, {del_p.deleted_count} partners, {del_b.deleted_count} branches")

    total_branches = 0
    for v in VENDORS:
        vendor_id = str(uuid.uuid4())
        hashed = hash_pw(v["password"])

        vendor = {
            "id": vendor_id, "store_name": v["store_name"], "email": v["email"],
            "password_hash": hashed, "phone": v["phone"], "category": v["category"],
            "status": "approved", "is_active": True, "image": v.get("image", ""),
            "description": v.get("description", ""),
            "lat": v["branches"][0]["lat"], "lng": v["branches"][0]["lng"],
            "address": v["branches"][0]["address"], "created_at": datetime.utcnow(),
        }
        await db.vendors.insert_one(vendor)

        partner = {
            "id": str(uuid.uuid4()), "vendor_id": vendor_id, "name": v["store_name"],
            "category": v["category"], "image": v.get("image", ""),
            "description": v.get("description", ""), "phone": v["phone"],
            "lat": v["branches"][0]["lat"], "lng": v["branches"][0]["lng"],
            "address": v["branches"][0]["address"], "points_per_rm": 10,
            "operating_hours": v["branches"][0].get("operating_hours", ""),
            "navigation_enabled": True, "is_active": True, "status": "active",
            "created_at": datetime.utcnow(),
        }
        await db.partners.insert_one(partner)

        for br in v["branches"]:
            branch = {
                "id": str(uuid.uuid4()), "vendor_id": vendor_id,
                "name": br["name"], "address": br["address"], "phone": v["phone"],
                "operating_hours": br.get("operating_hours", ""),
                "lat": br["lat"], "lng": br["lng"],
                "latitude": br["lat"], "longitude": br["lng"],
                "navigation_enabled": True, "is_active": True,
                "created_at": datetime.utcnow(),
            }
            await db.branches.insert_one(branch)
            total_branches += 1

        print(f"  Created: {v['store_name']} ({len(v['branches'])} branches) - {v['email']}")

    print(f"\n  Total: {len(VENDORS)} vendors, {total_branches} branches")
    print(f"\n--- Vendor Credentials ---")
    for v in VENDORS:
        print(f"  {v['store_name']}: {v['email']} / {v['password']}")

    client.close()
    print("\nSeed complete!")


if __name__ == "__main__":
    asyncio.run(seed())
