-- Add role to profiles table for admin authentication
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin'));

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  roast_level TEXT CHECK (roast_level IN ('light', 'medium', 'dark')),
  flavor_notes TEXT[],
  origin TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create variants table
CREATE TABLE public.variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  grind_type TEXT NOT NULL,
  price NUMERIC NOT NULL,
  stock_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'processing', 'shipped', 'completed', 'canceled')),
  total_amount NUMERIC NOT NULL,
  shipping_name TEXT NOT NULL,
  shipping_email TEXT NOT NULL,
  shipping_phone TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  shipping_city TEXT NOT NULL,
  shipping_state TEXT NOT NULL,
  shipping_pincode TEXT NOT NULL,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'success', 'failed')),
  payment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order_items table
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  grind_type TEXT NOT NULL,
  bag_size TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_addresses table for multiple addresses
CREATE TABLE public.user_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

-- Products: Everyone can view active products
CREATE POLICY "Anyone can view active products" 
ON public.products 
FOR SELECT 
USING (is_active = true);

-- Products: Only admins can manage products
CREATE POLICY "Admins can manage products" 
ON public.products 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Variants: Everyone can view variants
CREATE POLICY "Anyone can view variants" 
ON public.variants 
FOR SELECT 
USING (true);

-- Variants: Only admins can manage variants
CREATE POLICY "Admins can manage variants" 
ON public.variants 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Orders: Users can view their own orders
CREATE POLICY "Users can view their own orders" 
ON public.orders 
FOR SELECT 
USING (auth.uid() = user_id);

-- Orders: Users can create their own orders
CREATE POLICY "Users can create their own orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Orders: Admins can view all orders
CREATE POLICY "Admins can view all orders" 
ON public.orders 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Orders: Admins can update orders
CREATE POLICY "Admins can update orders" 
ON public.orders 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Order Items: Users can view their own order items
CREATE POLICY "Users can view their own order items" 
ON public.order_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
  )
);

-- Order Items: Users can create order items for their orders
CREATE POLICY "Users can create order items" 
ON public.order_items 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
  )
);

-- Order Items: Admins can view all order items
CREATE POLICY "Admins can view all order items" 
ON public.order_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- User Addresses: Users can manage their own addresses
CREATE POLICY "Users can view their own addresses" 
ON public.user_addresses 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own addresses" 
ON public.user_addresses 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own addresses" 
ON public.user_addresses 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own addresses" 
ON public.user_addresses 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_variants_updated_at
  BEFORE UPDATE ON public.variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_addresses_updated_at
  BEFORE UPDATE ON public.user_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the 3 products as per PRD (max 3 products)
INSERT INTO public.products (id, name, description, roast_level, flavor_notes, origin, image_url) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Ethiopian Yirgacheffe', 'A bright and fruity single-origin coffee with complex floral notes and a wine-like acidity.', 'light', ARRAY['Blueberry', 'Jasmine', 'Citrus'], 'Ethiopia', 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500&h=500&fit=crop'),
  ('22222222-2222-2222-2222-222222222222', 'Colombian Supremo', 'A well-balanced medium roast with caramel sweetness and nutty undertones.', 'medium', ARRAY['Caramel', 'Walnut', 'Chocolate'], 'Colombia', 'https://images.unsplash.com/photo-1587734195503-904fca47e0e9?w=500&h=500&fit=crop'),
  ('33333333-3333-3333-3333-333333333333', 'Sumatra Mandheling', 'A bold and earthy dark roast with low acidity and full body.', 'dark', ARRAY['Dark Chocolate', 'Earthy', 'Spice'], 'Indonesia', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&h=500&fit=crop');

-- Insert variants for each product (grind types x sizes)
INSERT INTO public.variants (product_id, size, grind_type, price, stock_count) VALUES
  -- Ethiopian Yirgacheffe variants
  ('11111111-1111-1111-1111-111111111111', '250g', 'whole_bean', 650, 50),
  ('11111111-1111-1111-1111-111111111111', '250g', 'coarse', 650, 50),
  ('11111111-1111-1111-1111-111111111111', '250g', 'medium', 650, 50),
  ('11111111-1111-1111-1111-111111111111', '250g', 'fine', 650, 50),
  ('11111111-1111-1111-1111-111111111111', '500g', 'whole_bean', 1235, 30),
  ('11111111-1111-1111-1111-111111111111', '500g', 'coarse', 1235, 30),
  ('11111111-1111-1111-1111-111111111111', '500g', 'medium', 1235, 30),
  ('11111111-1111-1111-1111-111111111111', '500g', 'fine', 1235, 30),
  ('11111111-1111-1111-1111-111111111111', '1kg', 'whole_bean', 2275, 20),
  ('11111111-1111-1111-1111-111111111111', '1kg', 'coarse', 2275, 20),
  ('11111111-1111-1111-1111-111111111111', '1kg', 'medium', 2275, 20),
  ('11111111-1111-1111-1111-111111111111', '1kg', 'fine', 2275, 20),
  -- Colombian Supremo variants
  ('22222222-2222-2222-2222-222222222222', '250g', 'whole_bean', 550, 50),
  ('22222222-2222-2222-2222-222222222222', '250g', 'coarse', 550, 50),
  ('22222222-2222-2222-2222-222222222222', '250g', 'medium', 550, 50),
  ('22222222-2222-2222-2222-222222222222', '250g', 'fine', 550, 50),
  ('22222222-2222-2222-2222-222222222222', '500g', 'whole_bean', 1045, 30),
  ('22222222-2222-2222-2222-222222222222', '500g', 'coarse', 1045, 30),
  ('22222222-2222-2222-2222-222222222222', '500g', 'medium', 1045, 30),
  ('22222222-2222-2222-2222-222222222222', '500g', 'fine', 1045, 30),
  ('22222222-2222-2222-2222-222222222222', '1kg', 'whole_bean', 1925, 20),
  ('22222222-2222-2222-2222-222222222222', '1kg', 'coarse', 1925, 20),
  ('22222222-2222-2222-2222-222222222222', '1kg', 'medium', 1925, 20),
  ('22222222-2222-2222-2222-222222222222', '1kg', 'fine', 1925, 20),
  -- Sumatra Mandheling variants
  ('33333333-3333-3333-3333-333333333333', '250g', 'whole_bean', 700, 50),
  ('33333333-3333-3333-3333-333333333333', '250g', 'coarse', 700, 50),
  ('33333333-3333-3333-3333-333333333333', '250g', 'medium', 700, 50),
  ('33333333-3333-3333-3333-333333333333', '250g', 'fine', 700, 50),
  ('33333333-3333-3333-3333-333333333333', '500g', 'whole_bean', 1330, 30),
  ('33333333-3333-3333-3333-333333333333', '500g', 'coarse', 1330, 30),
  ('33333333-3333-3333-3333-333333333333', '500g', 'medium', 1330, 30),
  ('33333333-3333-3333-3333-333333333333', '500g', 'fine', 1330, 30),
  ('33333333-3333-3333-3333-333333333333', '1kg', 'whole_bean', 2450, 20),
  ('33333333-3333-3333-3333-333333333333', '1kg', 'coarse', 2450, 20),
  ('33333333-3333-3333-3333-333333333333', '1kg', 'medium', 2450, 20),
  ('33333333-3333-3333-3333-333333333333', '1kg', 'fine', 2450, 20);

-- Create function to decrement stock on order
CREATE OR REPLACE FUNCTION public.decrement_stock(variant_uuid UUID, qty INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.variants 
  SET stock_count = stock_count - qty 
  WHERE id = variant_uuid AND stock_count >= qty;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock for variant %', variant_uuid;
  END IF;
END;
$$;

