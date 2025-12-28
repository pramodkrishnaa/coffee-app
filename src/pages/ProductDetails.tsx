import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { products } from "@/data/products";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Minus, Plus, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Variant {
  id: string;
  size: string;
  grind_type: string;
  price: number;
  stock_count: number;
}

const grindOptions = [
  { value: "whole_bean", label: "Whole Bean" },
  { value: "coarse", label: "Coarse (French Press)" },
  { value: "medium", label: "Medium (Drip)" },
  { value: "fine", label: "Fine (Espresso)" },
];

const sizeOptions = [
  { value: "250g", label: "250g", priceMultiplier: 1 },
  { value: "500g", label: "500g", priceMultiplier: 1.9 },
  { value: "1kg", label: "1kg", priceMultiplier: 3.5 },
];

const ProductDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { addToCart } = useCart();
  
  const [quantity, setQuantity] = useState(1);
  const [grindType, setGrindType] = useState("whole_bean");
  const [bagSize, setBagSize] = useState("250g");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(true);

  const product = products.find((p) => p.id === id);

  useEffect(() => {
    if (product) {
      fetchVariants();
    }
  }, [product]);

  const fetchVariants = async () => {
    if (!product) return;
    
    setLoadingVariants(true);
    const { data } = await supabase
      .from("variants")
      .select("*")
      .eq("product_id", product.id);

    if (data) {
      setVariants(data);
    }
    setLoadingVariants(false);
  };

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-16 text-center">
          <h1 className="font-display text-3xl mb-4">Product Not Found</h1>
          <p className="text-muted-foreground mb-8">
            The product you're looking for doesn't exist.
          </p>
          <Button asChild>
            <Link to="/">Back to Products</Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  // Get current variant based on selection
  const currentVariant = variants.find(
    v => v.size === bagSize && v.grind_type === grindType
  );

  // Use variant price if available, otherwise calculate from base price
  const selectedSize = sizeOptions.find((s) => s.value === bagSize);
  const currentPrice = currentVariant?.price ?? product.price * (selectedSize?.priceMultiplier || 1);
  
  // Stock status
  const stockCount = currentVariant?.stock_count ?? 0;
  const isInStock = stockCount > 0;
  const isLowStock = stockCount > 0 && stockCount < 10;

  const getRoastBadgeClass = (roastLevel: string) => {
    switch (roastLevel) {
      case "light":
        return "bg-accent-green text-white";
      case "medium":
        return "bg-accent-blue text-white";
      case "dark":
        return "bg-accent-red text-white";
      default:
        return "bg-muted";
    }
  };

  const handleAddToCart = async () => {
    if (!isInStock) return;
    
    await addToCart({
      product_id: product.id,
      product_name: product.name,
      product_image: product.image,
      price: currentPrice,
      quantity,
      grind_type: grindType,
      bag_size: bagSize,
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8 lg:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Products
        </Link>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Product Image */}
          <div className="relative">
            <img
              src={product.image}
              alt={product.name}
              className="w-full aspect-square object-cover rounded-lg"
            />
            <Badge className={`absolute top-4 left-4 ${getRoastBadgeClass(product.roastLevel)}`}>
              {product.roastLevel.toUpperCase()} ROAST
            </Badge>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <p className="text-muted-foreground mb-2">{product.origin}</p>
              <h1 className="font-display text-4xl lg:text-5xl mb-4">{product.name}</h1>
              <p className="text-2xl font-semibold text-primary">
                Rs. {currentPrice.toFixed(2)}
              </p>
            </div>

            {/* Stock Status */}
            {loadingVariants ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking availability...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {isInStock ? (
                  <>
                    <CheckCircle className={`h-5 w-5 ${isLowStock ? 'text-orange-500' : 'text-green-500'}`} />
                    <span className={isLowStock ? 'text-orange-500' : 'text-green-500'}>
                      {isLowStock ? `Only ${stockCount} left in stock` : 'In Stock'}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-500">Out of Stock</span>
                  </>
                )}
              </div>
            )}

            <p className="text-muted-foreground leading-relaxed">
              {product.description}
            </p>

            <div>
              <h3 className="font-medium mb-2">Flavor Notes</h3>
              <div className="flex flex-wrap gap-2">
                {product.flavorNotes.map((note) => (
                  <Badge key={note} variant="outline">
                    {note}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-medium mb-2">Grind Type</label>
                <Select value={grindType} onValueChange={setGrindType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {grindOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block font-medium mb-2">Bag Size</label>
                <Select value={bagSize} onValueChange={setBagSize}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sizeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block font-medium mb-2">Quantity</label>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={!isInStock}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-xl font-medium w-8 text-center">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.min(stockCount, quantity + 1))}
                    disabled={!isInStock || quantity >= stockCount}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <Button 
              size="lg" 
              className="w-full" 
              onClick={handleAddToCart}
              disabled={!isInStock}
            >
              {isInStock 
                ? `Add to Cart — Rs. ${(currentPrice * quantity).toFixed(2)}`
                : 'Out of Stock'
              }
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProductDetails;
