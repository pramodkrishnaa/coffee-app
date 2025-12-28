import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string;
  price: number;
  quantity: number;
  grind_type: string;
  bag_size: string;
}

interface CartContextType {
  items: CartItem[];
  loading: boolean;
  addToCart: (item: Omit<CartItem, "id">) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  removeFromCart: (id: string) => Promise<void>;
  clearCart: () => Promise<void>;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchCartItems();
    } else {
      setItems([]);
      setLoading(false);
    }
  }, [user]);

  const fetchCartItems = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("cart_items")
      .select("*")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching cart:", error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const addToCart = async (item: Omit<CartItem, "id">) => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be logged in to add items to cart",
        variant: "destructive",
      });
      return;
    }

    const existingItem = items.find(
      (i) =>
        i.product_id === item.product_id &&
        i.grind_type === item.grind_type &&
        i.bag_size === item.bag_size
    );

    if (existingItem) {
      await updateQuantity(existingItem.id, existingItem.quantity + item.quantity);
    } else {
      const { data, error } = await supabase
        .from("cart_items")
        .insert({
          user_id: user.id,
          ...item,
        })
        .select()
        .single();

      if (error) {
        console.error("Error adding to cart:", error);
        toast({
          title: "Error",
          description: "Failed to add item to cart",
          variant: "destructive",
        });
      } else {
        setItems([...items, data]);
        toast({
          title: "Added to cart",
          description: `${item.product_name} has been added to your cart`,
        });
      }
    }
  };

  const updateQuantity = async (id: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(id);
      return;
    }

    const { error } = await supabase
      .from("cart_items")
      .update({ quantity })
      .eq("id", id);

    if (error) {
      console.error("Error updating quantity:", error);
    } else {
      setItems(items.map((item) => (item.id === id ? { ...item, quantity } : item)));
    }
  };

  const removeFromCart = async (id: string) => {
    const { error } = await supabase.from("cart_items").delete().eq("id", id);

    if (error) {
      console.error("Error removing from cart:", error);
    } else {
      setItems(items.filter((item) => item.id !== id));
      toast({
        title: "Removed from cart",
        description: "Item has been removed from your cart",
      });
    }
  };

  const clearCart = async () => {
    if (!user) return;

    const { error } = await supabase.from("cart_items").delete().eq("user_id", user.id);

    if (error) {
      console.error("Error clearing cart:", error);
    } else {
      setItems([]);
    }
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        loading,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
