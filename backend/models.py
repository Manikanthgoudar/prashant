from typing import List, Optional
from sqlmodel import Field, SQLModel, Relationship
from datetime import datetime

class CategoryBase(SQLModel):
    name: str
    icon: Optional[str] = None
    parent_id: Optional[int] = Field(default=None, foreign_key="category.id")

class Category(CategoryBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    products: List["Product"] = Relationship(back_populates="category")
    subcategories: List["Category"] = Relationship(
        sa_relationship_kwargs={"remote_side": "Category.id"}
    )

class ProductBase(SQLModel):
    name: str
    description: str
    price: float
    image_url: str
    stock: int = 100
    category_id: int = Field(foreign_key="category.id")
    colors: Optional[str] = Field(default=None) # Comma separated colors e.g. "Space Gray,Silver,Gold"

class Product(ProductBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    category: Category = Relationship(back_populates="products")


class UserBase(SQLModel):
    name: str
    email: str


class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    hashed_password: str
    orders: List["Order"] = Relationship(back_populates="user")

class OrderItemBase(SQLModel):
    product_id: int
    name: str
    price: float
    quantity: int = 1
    color: Optional[str] = None

class OrderItem(OrderItemBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="order.id")
    order: "Order" = Relationship(back_populates="items")

class OrderBase(SQLModel):
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    order_id_str: str
    total_price: float
    payment_method: str
    payment_status: str = "Success"
    full_name: str
    phone: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    pincode: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Order(OrderBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user: Optional[User] = Relationship(back_populates="orders")
    items: List[OrderItem] = Relationship(back_populates="order")

class CategoryRead(CategoryBase):
    id: int

class ProductRead(ProductBase):
    id: int

class CategoryWithSubcategories(CategoryRead):
    subcategories: List[CategoryRead] = []

class ProductWithCategory(ProductRead):
    category: CategoryRead

class OrderItemRead(OrderItemBase):
    id: int
    order_id: int

class OrderRead(OrderBase):
    id: int
    items: List[OrderItemRead] = []

