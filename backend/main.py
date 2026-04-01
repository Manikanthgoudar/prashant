from fastapi import FastAPI, Depends, HTTPException, Body, Header
from sqlmodel import Session, select
from typing import List, Optional
from db import get_session, create_db_and_tables
from models import Category, Product, CategoryRead, ProductRead, ProductWithCategory, User, Order, OrderItem, OrderRead
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from passlib.hash import bcrypt
from jose import jwt, JWTError
import asyncio

# Simple JWT config for development
SECRET_KEY = "stella-dev-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

app = FastAPI(title="Stella Ecommerce API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# ====== Request/Response Models ======

class UserSignup(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class AddressInfo(BaseModel):
    fullName: str
    phone: str
    addressLine1: str
    addressLine2: Optional[str] = ""
    city: str
    state: str
    pincode: str

class OrderItem(BaseModel):
    product_id: int
    name: str
    price: float
    quantity: int = 1
    color: Optional[str] = None

class OrderCreate(BaseModel):
    items: List[OrderItem]
    total_price: float
    address: AddressInfo
    payment_method: str  # 'cod', 'upi', 'netbanking'
    payment_details: Optional[str] = None  # e.g. 'googlepay', 'SBI', etc.
    user_email: Optional[str] = None  # Optional email to link order to user

class OrderResponse(BaseModel):
    status: str
    message: str
    order_id: str
    order_date: str
    estimated_delivery_min: str
    estimated_delivery_max: str
    payment_method: str
    total: float

# ====== Category Endpoints ======

@app.get("/categories", response_model=List[CategoryRead])
def read_categories(session: Session = Depends(get_session)):
    return session.exec(select(Category)).all()

@app.get("/categories/tree")
def read_categories_tree(session: Session = Depends(get_session)):
    categories = session.exec(select(Category)).all()
    cat_dict = {cat.id: {"id": cat.id, "name": cat.name, "parent_id": cat.parent_id, "children": []} for cat in categories}
    tree = []
    for cat_data in cat_dict.values():
        if cat_data["parent_id"] is None:
            tree.append(cat_data)
        elif cat_data["parent_id"] in cat_dict:
            cat_dict[cat_data["parent_id"]]["children"].append(cat_data)
    return tree

# ====== Product Endpoints ======

@app.get("/products", response_model=List[ProductRead])
def read_products(
    offset: int = 0, 
    limit: int = 100,
    category_id: Optional[int] = None, 
    q: Optional[str] = None,
    session: Session = Depends(get_session)
):
    query = select(Product)
    if category_id:
        query = query.where(Product.category_id == category_id)
    if q:
        # simple substring match on name/description
        query = query.where((Product.name.ilike(f"%{q}%")) | (Product.description.ilike(f"%{q}%")))
    return session.exec(query.offset(offset).limit(limit)).all()

@app.get("/product/{product_id}", response_model=ProductWithCategory)
def read_product(product_id: int, session: Session = Depends(get_session)):
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@app.get("/categories/{category_id}/products", response_model=List[ProductRead])
def read_category_products(category_id: int, session: Session = Depends(get_session)):
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # collect category ids recursively using queries to avoid relying on relationship loading
    cat_ids = [category.id]
    # first-level children
    children = session.exec(select(Category).where(Category.parent_id == category.id)).all()
    for child in children:
        cat_ids.append(child.id)
        # second level
        subchildren = session.exec(select(Category).where(Category.parent_id == child.id)).all()
        for sc in subchildren:
            cat_ids.append(sc.id)

    products = session.exec(select(Product).where(Product.category_id.in_(cat_ids))).all()
    return products

# ====== Auth Endpoints ======

@app.post("/signup")
def signup(user: UserSignup, session: Session = Depends(get_session)):
    # check if user exists
    existing = session.exec(select(User).where(User.email == user.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    hashed = bcrypt.hash(user.password)
    db_user = User(name=user.name, email=user.email, hashed_password=hashed)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)

    # create token
    to_encode = {"sub": db_user.email, "name": db_user.name}
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return {"message": f"Welcome {db_user.name}! Account created.", "user": {"name": db_user.name, "email": db_user.email}, "token": token}

@app.post("/login")
def login(user: UserLogin, session: Session = Depends(get_session)):
    db_user = session.exec(select(User).where(User.email == user.email)).first()
    if not db_user or not bcrypt.verify(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    to_encode = {"sub": db_user.email, "name": db_user.name}
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return {"message": "Login successful!", "user": {"name": db_user.name, "email": db_user.email}, "token": token}


@app.get("/me")
def me(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    try:
        scheme, token = authorization.split()
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return {"email": payload.get("sub"), "name": payload.get("name")}

# ====== Order Endpoint ======

@app.post("/orders", response_model=OrderResponse)
def create_order(order: OrderCreate, session: Session = Depends(get_session)):
    # Simulate latency (1.5 seconds) to make it feel real
    import time
    time.sleep(1.5)
    
    now = datetime.now()
    order_id = f"STL{int(now.timestamp()) % 100000000}"
    
    # Try to link order to user if email provided
    user_id = None
    if order.user_email:
        db_user = session.exec(select(User).where(User.email == order.user_email)).first()
        if db_user:
            user_id = db_user.id
    
    # Create order in database
    db_order = Order(
        user_id=user_id,
        order_id_str=order_id,
        total_price=order.total_price,
        payment_method=order.payment_method,
        payment_status="Success",
        full_name=order.address.fullName,
        phone=order.address.phone,
        address_line1=order.address.addressLine1,
        address_line2=order.address.addressLine2,
        city=order.address.city,
        state=order.address.state,
        pincode=order.address.pincode,
    )
    session.add(db_order)
    session.flush()  # Get the ID
    
    # Add order items
    for item in order.items:
        db_item = OrderItem(
            order_id=db_order.id,
            product_id=item.product_id,
            name=item.name,
            price=item.price,
            quantity=item.quantity,
            color=item.color,
        )
        session.add(db_item)
    
    session.commit()
    session.refresh(db_order)
    
    delivery_min = now + timedelta(days=5)
    delivery_max = now + timedelta(days=7)
    
    return OrderResponse(
        status="success",
        message="Order placed successfully! Your items are being prepared.",
        order_id=order_id,
        order_date=now.strftime("%A, %B %d, %Y"),
        estimated_delivery_min=delivery_min.strftime("%A, %B %d"),
        estimated_delivery_max=delivery_max.strftime("%A, %B %d"),
        payment_method=order.payment_method,
        total=order.total_price,
    )

@app.get("/orders/{order_id}", response_model=OrderRead)
def get_order(order_id: str, session: Session = Depends(get_session)):
    db_order = session.exec(select(Order).where(Order.order_id_str == order_id)).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    return db_order

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
