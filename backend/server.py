from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
import qrcode
import io
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'rewardshub')]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'rewardshub-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# Create the main app
app = FastAPI(title="RewardsHub API", version="1.0.0")

# Create router with /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ========================= MODELS =========================

# User Models
class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    phone: Optional[str] = None
    profile_image: Optional[str] = None
    points_balance: int = 0
    total_earned: int = 0
    total_redeemed: int = 0
    qr_code: str
    currency: str = "USD"
    created_at: datetime

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    profile_image: Optional[str] = None
    currency: Optional[str] = None

class PasswordReset(BaseModel):
    email: str

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

# Transaction Models
class TransactionCreate(BaseModel):
    partner_id: Optional[str] = None
    type: str  # "earn" or "redeem"
    points: int
    description: str

class TransactionResponse(BaseModel):
    id: str
    user_id: str
    partner_id: Optional[str] = None
    partner_name: Optional[str] = None
    type: str
    points: int
    description: str
    reference_code: str
    created_at: datetime

# Partner Models
class PartnerCreate(BaseModel):
    name: str
    logo: Optional[str] = None
    description: str
    category: str
    address: str
    points_multiplier: float = 1.0
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class PartnerResponse(BaseModel):
    id: str
    name: str
    logo: Optional[str] = None
    description: str
    category: str
    address: str
    points_multiplier: float
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: bool = True
    created_at: datetime

# Reward Models
class RewardCreate(BaseModel):
    name: str
    description: str
    image: Optional[str] = None
    points_required: int
    category: str
    terms_conditions: Optional[str] = None
    quantity: int = -1  # -1 means unlimited

class RewardResponse(BaseModel):
    id: str
    name: str
    description: str
    image: Optional[str] = None
    points_required: int
    category: str
    terms_conditions: Optional[str] = None
    quantity: int
    is_active: bool = True
    created_at: datetime

# QR Scan Model
class QRScanRequest(BaseModel):
    qr_code: str
    partner_id: str
    amount: float  # Transaction amount in currency
    points_multiplier: float = 1.0

# Redemption Model
class RedeemRequest(BaseModel):
    reward_id: str

class RedemptionResponse(BaseModel):
    id: str
    user_id: str
    reward_id: str
    reward_name: str
    points_used: int
    redemption_code: str
    status: str
    created_at: datetime

# ========================= HELPER FUNCTIONS =========================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_jwt_token(token)
    user = await db.users.find_one({"id": payload["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def generate_qr_code_base64(data: str) -> str:
    """Generate QR code as base64 string"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()

def generate_reference_code() -> str:
    return f"RH{datetime.utcnow().strftime('%Y%m%d')}{str(uuid.uuid4())[:8].upper()}"

def serialize_doc(doc: dict) -> dict:
    """Remove MongoDB _id field from document"""
    if doc and '_id' in doc:
        del doc['_id']
    return doc

def serialize_docs(docs: list) -> list:
    """Remove MongoDB _id field from list of documents"""
    return [serialize_doc(doc) for doc in docs]

# ========================= AUTH ENDPOINTS =========================

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if email already exists
    existing_user = await db.users.find_one({"email": user_data.email.lower()})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    qr_code = f"RH-{user_id[:8].upper()}"
    
    user = {
        "id": user_id,
        "email": user_data.email.lower(),
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "phone": user_data.phone,
        "profile_image": None,
        "points_balance": 100,  # Welcome bonus
        "total_earned": 100,
        "total_redeemed": 0,
        "qr_code": qr_code,
        "currency": "USD",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user)
    
    # Create welcome transaction
    welcome_transaction = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "partner_id": None,
        "partner_name": "RewardsHub",
        "type": "earn",
        "points": 100,
        "description": "Welcome bonus! Thanks for joining RewardsHub",
        "reference_code": generate_reference_code(),
        "created_at": datetime.utcnow()
    }
    await db.transactions.insert_one(welcome_transaction)
    
    token = create_jwt_token(user_id, user_data.email.lower())
    
    return {
        "message": "Registration successful",
        "token": token,
        "user": {
            "id": user_id,
            "email": user_data.email.lower(),
            "name": user_data.name,
            "phone": user_data.phone,
            "points_balance": 100,
            "total_earned": 100,
            "total_redeemed": 0,
            "qr_code": qr_code,
            "currency": "USD",
            "created_at": user["created_at"]
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email.lower()})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_jwt_token(user["id"], user["email"])
    
    return {
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "phone": user.get("phone"),
            "profile_image": user.get("profile_image"),
            "points_balance": user["points_balance"],
            "total_earned": user["total_earned"],
            "total_redeemed": user["total_redeemed"],
            "qr_code": user["qr_code"],
            "currency": user.get("currency", "USD"),
            "created_at": user["created_at"]
        }
    }

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "phone": current_user.get("phone"),
        "profile_image": current_user.get("profile_image"),
        "points_balance": current_user["points_balance"],
        "total_earned": current_user["total_earned"],
        "total_redeemed": current_user["total_redeemed"],
        "qr_code": current_user["qr_code"],
        "currency": current_user.get("currency", "USD"),
        "created_at": current_user["created_at"]
    }

@api_router.put("/auth/profile")
async def update_profile(update_data: UserUpdate, current_user: dict = Depends(get_current_user)):
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.utcnow()
    
    if update_dict:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": update_dict}
        )
    
    updated_user = await db.users.find_one({"id": current_user["id"]})
    return {
        "message": "Profile updated successfully",
        "user": {
            "id": updated_user["id"],
            "email": updated_user["email"],
            "name": updated_user["name"],
            "phone": updated_user.get("phone"),
            "profile_image": updated_user.get("profile_image"),
            "points_balance": updated_user["points_balance"],
            "total_earned": updated_user["total_earned"],
            "total_redeemed": updated_user["total_redeemed"],
            "qr_code": updated_user["qr_code"],
            "currency": updated_user.get("currency", "USD"),
            "created_at": updated_user["created_at"]
        }
    }

@api_router.post("/auth/change-password")
async def change_password(data: PasswordChange, current_user: dict = Depends(get_current_user)):
    if not verify_password(data.old_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password_hash": hash_password(data.new_password), "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Password changed successfully"}

# ========================= WALLET ENDPOINTS =========================

@api_router.get("/wallet/balance")
async def get_balance(current_user: dict = Depends(get_current_user)):
    return {
        "points_balance": current_user["points_balance"],
        "total_earned": current_user["total_earned"],
        "total_redeemed": current_user["total_redeemed"],
        "currency": current_user.get("currency", "USD")
    }

@api_router.get("/wallet/transactions")
async def get_transactions(
    type: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["id"]}
    if type and type in ["earn", "redeem"]:
        query["type"] = type
    
    transactions = await db.transactions.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.transactions.count_documents(query)
    
    return {
        "transactions": serialize_docs(transactions),
        "total": total,
        "limit": limit,
        "skip": skip
    }

@api_router.get("/wallet/qr-code")
async def get_qr_code(current_user: dict = Depends(get_current_user)):
    qr_base64 = generate_qr_code_base64(current_user["qr_code"])
    return {
        "qr_code": current_user["qr_code"],
        "qr_image": f"data:image/png;base64,{qr_base64}"
    }

# ========================= EARN ENDPOINTS =========================

@api_router.post("/earn/scan")
async def process_qr_scan(scan_data: QRScanRequest):
    """Process QR code scan from partner POS"""
    # Find user by QR code
    user = await db.users.find_one({"qr_code": scan_data.qr_code})
    if not user:
        raise HTTPException(status_code=404, detail="Invalid QR code")
    
    # Find partner
    partner = await db.partners.find_one({"id": scan_data.partner_id})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    # Calculate points (1 point per dollar, with multiplier)
    base_points = int(scan_data.amount)
    total_multiplier = partner["points_multiplier"] * scan_data.points_multiplier
    earned_points = int(base_points * total_multiplier)
    
    # Update user balance
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$inc": {
                "points_balance": earned_points,
                "total_earned": earned_points
            },
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    # Create transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "partner_id": partner["id"],
        "partner_name": partner["name"],
        "type": "earn",
        "points": earned_points,
        "description": f"Earned {earned_points} points at {partner['name']}",
        "reference_code": generate_reference_code(),
        "created_at": datetime.utcnow()
    }
    await db.transactions.insert_one(transaction)
    
    return {
        "message": "Points earned successfully",
        "points_earned": earned_points,
        "new_balance": user["points_balance"] + earned_points,
        "transaction": transaction
    }

@api_router.post("/earn/demo")
async def demo_earn_points(current_user: dict = Depends(get_current_user)):
    """Demo endpoint to earn points (for testing)"""
    earned_points = 50
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$inc": {
                "points_balance": earned_points,
                "total_earned": earned_points
            },
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "partner_id": None,
        "partner_name": "Demo Partner",
        "type": "earn",
        "points": earned_points,
        "description": f"Demo: Earned {earned_points} points",
        "reference_code": generate_reference_code(),
        "created_at": datetime.utcnow()
    }
    await db.transactions.insert_one(transaction)
    
    return {
        "message": "Demo points earned!",
        "points_earned": earned_points,
        "new_balance": current_user["points_balance"] + earned_points
    }

# ========================= PARTNER ENDPOINTS =========================

@api_router.get("/partners")
async def get_partners(
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    query = {"is_active": True}
    
    if category:
        query["category"] = category
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    partners = await db.partners.find(query).skip(skip).limit(limit).to_list(limit)
    total = await db.partners.count_documents(query)
    
    # Get unique categories
    categories = await db.partners.distinct("category", {"is_active": True})
    
    return {
        "partners": serialize_docs(partners),
        "categories": categories,
        "total": total,
        "limit": limit,
        "skip": skip
    }

@api_router.get("/partners/{partner_id}")
async def get_partner(partner_id: str):
    partner = await db.partners.find_one({"id": partner_id})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return serialize_doc(partner)

@api_router.post("/partners")
async def create_partner(partner_data: PartnerCreate):
    partner = {
        "id": str(uuid.uuid4()),
        **partner_data.dict(),
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    await db.partners.insert_one(partner)
    return serialize_doc(partner)

# ========================= REWARDS ENDPOINTS =========================

@api_router.get("/rewards")
async def get_rewards(
    category: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    query = {"is_active": True}
    
    if category:
        query["category"] = category
    
    rewards = await db.rewards.find(query).skip(skip).limit(limit).to_list(limit)
    total = await db.rewards.count_documents(query)
    
    # Get unique categories
    categories = await db.rewards.distinct("category", {"is_active": True})
    
    return {
        "rewards": serialize_docs(rewards),
        "categories": categories,
        "total": total,
        "limit": limit,
        "skip": skip
    }

@api_router.get("/rewards/{reward_id}")
async def get_reward(reward_id: str):
    reward = await db.rewards.find_one({"id": reward_id})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    return serialize_doc(reward)

@api_router.post("/rewards")
async def create_reward(reward_data: RewardCreate):
    reward = {
        "id": str(uuid.uuid4()),
        **reward_data.dict(),
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    await db.rewards.insert_one(reward)
    return serialize_doc(reward)

# ========================= REDEMPTION ENDPOINTS =========================

@api_router.post("/redeem")
async def redeem_reward(redeem_data: RedeemRequest, current_user: dict = Depends(get_current_user)):
    # Get reward
    reward = await db.rewards.find_one({"id": redeem_data.reward_id, "is_active": True})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    # Check if user has enough points
    if current_user["points_balance"] < reward["points_required"]:
        raise HTTPException(status_code=400, detail="Insufficient points")
    
    # Check quantity
    if reward["quantity"] != -1 and reward["quantity"] <= 0:
        raise HTTPException(status_code=400, detail="Reward out of stock")
    
    # Deduct points
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$inc": {
                "points_balance": -reward["points_required"],
                "total_redeemed": reward["points_required"]
            },
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    # Update reward quantity if limited
    if reward["quantity"] != -1:
        await db.rewards.update_one(
            {"id": reward["id"]},
            {"$inc": {"quantity": -1}}
        )
    
    # Create redemption record
    redemption_code = f"RDM-{str(uuid.uuid4())[:8].upper()}"
    redemption = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "reward_id": reward["id"],
        "reward_name": reward["name"],
        "points_used": reward["points_required"],
        "redemption_code": redemption_code,
        "status": "active",
        "created_at": datetime.utcnow()
    }
    await db.redemptions.insert_one(redemption)
    
    # Create transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "partner_id": None,
        "partner_name": "RewardsHub",
        "type": "redeem",
        "points": reward["points_required"],
        "description": f"Redeemed: {reward['name']}",
        "reference_code": redemption_code,
        "created_at": datetime.utcnow()
    }
    await db.transactions.insert_one(transaction)
    
    return {
        "message": "Reward redeemed successfully",
        "redemption": redemption,
        "new_balance": current_user["points_balance"] - reward["points_required"]
    }

@api_router.get("/redemptions")
async def get_redemptions(current_user: dict = Depends(get_current_user)):
    redemptions = await db.redemptions.find({"user_id": current_user["id"]}).sort("created_at", -1).to_list(100)
    return {"redemptions": serialize_docs(redemptions)}

# ========================= SEED DATA =========================

@api_router.post("/seed")
async def seed_data():
    """Seed the database with sample data"""
    
    # Sample Partners
    partners = [
        {
            "id": str(uuid.uuid4()),
            "name": "Starbucks",
            "logo": None,
            "description": "Premium coffee and beverages",
            "category": "Food & Beverage",
            "address": "123 Main Street",
            "points_multiplier": 2.0,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Nike Store",
            "logo": None,
            "description": "Athletic apparel and footwear",
            "category": "Shopping",
            "address": "456 Fashion Ave",
            "points_multiplier": 1.5,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Shell Gas Station",
            "logo": None,
            "description": "Fuel and convenience store",
            "category": "Fuel",
            "address": "789 Highway Blvd",
            "points_multiplier": 1.0,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "McDonald's",
            "logo": None,
            "description": "Fast food restaurant",
            "category": "Food & Beverage",
            "address": "321 Burger Lane",
            "points_multiplier": 1.5,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Amazon Fresh",
            "logo": None,
            "description": "Grocery delivery service",
            "category": "Grocery",
            "address": "555 Delivery Rd",
            "points_multiplier": 1.0,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Hilton Hotels",
            "logo": None,
            "description": "Luxury hotel accommodations",
            "category": "Travel",
            "address": "888 Resort Blvd",
            "points_multiplier": 3.0,
            "is_active": True,
            "created_at": datetime.utcnow()
        }
    ]
    
    # Sample Rewards
    rewards = [
        {
            "id": str(uuid.uuid4()),
            "name": "$5 Cash Back",
            "description": "Get $5 credited to your account",
            "image": None,
            "points_required": 500,
            "category": "Cash",
            "terms_conditions": "Valid for 30 days. Cannot be combined with other offers.",
            "quantity": -1,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "$10 Cash Back",
            "description": "Get $10 credited to your account",
            "image": None,
            "points_required": 1000,
            "category": "Cash",
            "terms_conditions": "Valid for 30 days. Cannot be combined with other offers.",
            "quantity": -1,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Free Coffee",
            "description": "Redeem for a free medium coffee at Starbucks",
            "image": None,
            "points_required": 200,
            "category": "Food & Beverage",
            "terms_conditions": "Valid at participating Starbucks locations. One per customer per day.",
            "quantity": 100,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "20% Off Nike",
            "description": "Get 20% off your next purchase at Nike Store",
            "image": None,
            "points_required": 300,
            "category": "Shopping",
            "terms_conditions": "Valid on regular priced items only. Cannot be combined with other offers.",
            "quantity": 50,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Free Fuel Upgrade",
            "description": "Upgrade to premium fuel for free (up to 15 gallons)",
            "image": None,
            "points_required": 400,
            "category": "Fuel",
            "terms_conditions": "Valid at Shell stations only. Maximum 15 gallons.",
            "quantity": 25,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Hotel Night Stay",
            "description": "One free night at Hilton Hotels",
            "image": None,
            "points_required": 5000,
            "category": "Travel",
            "terms_conditions": "Subject to availability. Blackout dates may apply.",
            "quantity": 10,
            "is_active": True,
            "created_at": datetime.utcnow()
        }
    ]
    
    # Clear existing data
    await db.partners.delete_many({})
    await db.rewards.delete_many({})
    
    # Insert new data
    await db.partners.insert_many(partners)
    await db.rewards.insert_many(rewards)
    
    return {
        "message": "Database seeded successfully",
        "partners_count": len(partners),
        "rewards_count": len(rewards)
    }

# ========================= HEALTH CHECK =========================

@api_router.get("/")
async def root():
    return {"message": "RewardsHub API is running", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Include router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
