from sqlmodel import Session, select
from db import engine, create_db_and_tables
from models import Category, Product
import random

CATEGORIES_DATA = {
    "Electronics": [
        "Mobiles & Smartphones",
        "Laptops & Computers",
        "Tablets",
        "Smart Watches",
        "Headphones & Earbuds",
        "Cameras & Accessories",
        "Gaming Consoles",
        "Computer Accessories",
    ],
    "Fashion": [
        "Men - Clothing",
        "Men - Footwear",
        "Men - Watches",
        "Men - Accessories",
        "Women - Clothing",
        "Women - Footwear",
        "Women - Handbags",
        "Women - Jewelry",
        "Kids - Boys Clothing",
        "Kids - Girls Clothing",
        "Kids - Toys",
    ],
    "Home & Living": [
        "Furniture",
        "Home Decor",
        "Kitchen Appliances",
        "Bedding & Furnishing",
        "Lighting",
    ],
    "Beauty & Personal Care": [
        "Skincare",
        "Haircare",
        "Makeup",
        "Grooming Products",
        "Fragrances",
    ],
    "Grocery & Essentials": [
        "Fruits & Vegetables",
        "Packaged Foods",
        "Beverages",
        "Snacks",
        "Household Supplies",
    ],
    "Sports & Fitness": [
        "Gym Equipment",
        "Outdoor Sports",
        "Fitness Accessories",
        "Yoga & Wellness",
    ],
    "Books & Education": [
        "Academic Books",
        "Novels",
        "Competitive Exams",
        "Stationery",
    ],
    "Toys & Baby Products": [
        "Toys & Games",
        "Baby Care",
        "Diapers",
        "Kids Accessories",
    ],
    "Automotive": [
        "Car Accessories",
        "Bike Accessories",
        "Tools & Equipment",
    ],
    "Health & Wellness": [
        "Medicines",
        "Supplements",
        "Medical Equipment",
    ],
    "Pet Supplies": [
        "Dog Food",
        "Cat Food",
        "Pet Accessories",
    ],
    "Offers & Deals": [
        "Daily Deals",
        "Discounts",
        "Combo Offers",
    ],
}

# BRAND NAMES MAPPING FOR REALISM
BRANDS = {
    "Mobiles": ["Apple iPhone 15 Pro", "Samsung Galaxy S24 Ultra", "Google Pixel 8 Pro", "OnePlus 12", "Xiaomi 14 Ultra"],
    "Laptops": ["MacBook Pro 16", "Dell XPS 15", "ASUS ROG Zephyrus", "HP Spectre x360", "Razer Blade 14"],
    "Cameras": ["Sony A7 IV", "Canon EOS R5", "Nikon Z9", "Fujifilm X-T5", "Panasonic Lumix S5II"],
    "Headphones": ["Sony WH-1000XM5", "Apple AirPods Max", "Bose QuietComfort Ultra", "Sennheiser Momentum 4", "Beats Studio Pro"],
    "Sneakers": ["Nike Air Jordan 1", "Adidas Yeezy Boost 350", "New Balance 990v6", "Asics Gel-Kayano 30", "Puma Velocity Nitro"],
    "Skincare": ["Estée Lauder Advanced Night Repair", "La Mer Crème de la Mer", "The Ordinary Hyaluronic Acid", "Drunk Elephant C-Firma", "SK-II Facial Treatment Essence"],
    "Fragrances": ["Dior Sauvage", "Chanel No. 5", "Tom Ford Lost Cherry", "Giorgio Armani Acqua di Gio", "Yves Saint Laurent Libre"]
}

def seed():
    create_db_and_tables()
    with Session(engine) as session:
        print("Starting Stella Vault Seeding...")
        
        for main_cat_name, sub_cats in CATEGORIES_DATA.items():
            print(f"Seeding {main_cat_name} collection...")
            main_cat = Category(name=main_cat_name)
            session.add(main_cat)
            session.flush() # Ensure ID is generated for children

            for sub_cat_name in sub_cats:
                f_cat = Category(name=sub_cat_name, parent_id=main_cat.id)
                session.add(f_cat)
                session.flush()
                add_products(session, f_cat)
        
        session.commit()
        print("Vault successfully populated with Real Brands!")

def add_products(session, category):
    category_meta = {
        "Mobiles": ["#000000,#C0C0C0,#313337", "Graphite, Silver, Titanium"],
        "Fashion": ["#FFFFFF,#000000,#B08D57", "Ivory, Pitch, Gold"],
        "Sneakers": ["#000000,#FFFFFF,#FF0000", "Black, White, Crimson"],
        "Furniture": ["#8B4513,#D2691E,#F4A460", "Oak, Saffron, Sand"]
    }

    brand_list = BRANDS.get(category.name, [f"Premium {category.name} Edition"])

    for i in range(1, 16):
        colors = category_meta.get(category.name, ["#000000,#FFFFFF"])[0] if category.name in category_meta else None
        base_name = brand_list[i % len(brand_list)] if i <= len(brand_list) else random.choice(brand_list)
        
        p = Product(
            name=f"{base_name} V{i}",
            description=f"Authentic {category.name} excellence. Curated globally for Stella.",
            price=round(random.uniform(200.0, 5000.0), 2),
            image_url=f"https://picsum.photos/seed/{category.name}{i+20}/400/400",
            category_id=category.id,
            stock=random.randint(5, 25),
            colors=colors
        )
        session.add(p)

if __name__ == "__main__":
    seed()
