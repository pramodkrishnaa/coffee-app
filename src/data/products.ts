export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  roastLevel: "light" | "medium" | "dark";
  flavorNotes: string[];
  origin: string;
}

// Fallback products data - used when database is unavailable
// Per PRD: max 3 products
export const products: Product[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Ethiopian Yirgacheffe",
    description: "A bright and fruity single-origin coffee with complex floral notes and a wine-like acidity.",
    price: 650.00,
    image: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500&h=500&fit=crop",
    roastLevel: "light",
    flavorNotes: ["Blueberry", "Jasmine", "Citrus"],
    origin: "Ethiopia"
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Colombian Supremo",
    description: "A well-balanced medium roast with caramel sweetness and nutty undertones.",
    price: 550.00,
    image: "https://images.unsplash.com/photo-1587734195503-904fca47e0e9?w=500&h=500&fit=crop",
    roastLevel: "medium",
    flavorNotes: ["Caramel", "Walnut", "Chocolate"],
    origin: "Colombia"
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Sumatra Mandheling",
    description: "A bold and earthy dark roast with low acidity and full body.",
    price: 700.00,
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&h=500&fit=crop",
    roastLevel: "dark",
    flavorNotes: ["Dark Chocolate", "Earthy", "Spice"],
    origin: "Indonesia"
  }
];
