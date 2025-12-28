import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut, Edit, Package } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string | null;
  roast_level: string | null;
  flavor_notes: string[] | null;
  origin: string | null;
  image_url: string | null;
  is_active: boolean;
}

interface Variant {
  id: string;
  product_id: string;
  size: string;
  grind_type: string;
  price: number;
  stock_count: number;
}

const AdminInventory = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Record<string, Variant[]>>({});
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      checkAdminRole();
    }
  }, [user, authLoading, navigate]);

  const checkAdminRole = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data?.role === "admin") {
      setIsAdmin(true);
      fetchProducts();
    } else {
      navigate("/");
    }
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data: productsData } = await supabase
      .from("products")
      .select("*")
      .order("name");

    if (productsData) {
      setProducts(productsData);
      
      // Fetch variants for all products
      const { data: variantsData } = await supabase
        .from("variants")
        .select("*")
        .order("size")
        .order("grind_type");

      if (variantsData) {
        const groupedVariants: Record<string, Variant[]> = {};
        variantsData.forEach(v => {
          if (!groupedVariants[v.product_id]) {
            groupedVariants[v.product_id] = [];
          }
          groupedVariants[v.product_id].push(v);
        });
        setVariants(groupedVariants);
      }
    }
  };

  const handleEditVariant = (variant: Variant) => {
    setEditingVariant({ ...variant });
    setDialogOpen(true);
  };

  const handleSaveVariant = async () => {
    if (!editingVariant) return;

    setSaving(true);
    const { error } = await supabase
      .from("variants")
      .update({
        price: editingVariant.price,
        stock_count: editingVariant.stock_count,
      })
      .eq("id", editingVariant.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update variant",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Saved",
        description: "Variant updated successfully",
      });
      setDialogOpen(false);
      fetchProducts();
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getStockBadge = (count: number) => {
    if (count === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (count < 10) {
      return <Badge className="bg-orange-500">Low Stock</Badge>;
    }
    return <Badge className="bg-green-500">In Stock</Badge>;
  };

  const grindLabels: Record<string, string> = {
    whole_bean: "Whole Bean",
    coarse: "Coarse (French Press)",
    medium: "Medium (Drip)",
    fine: "Fine (Espresso)",
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="bg-card border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/admin" className="font-display text-xl font-bold text-primary">
                Tiny Tiger Admin
              </Link>
              <nav className="hidden md:flex items-center gap-4">
                <Link
                  to="/admin"
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  to="/admin/orders"
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  Orders
                </Link>
                <Link
                  to="/admin/inventory"
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  Inventory
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="outline" size="sm">
                  View Store
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-3xl">Inventory</h1>
        </div>

        {/* Products List */}
        <div className="space-y-4">
          <Accordion type="multiple" className="space-y-4">
            {products.map((product) => (
              <AccordionItem
                key={product.id}
                value={product.id}
                className="bg-card border border-border rounded-lg overflow-hidden"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-4 text-left">
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div>
                      <h3 className="font-display text-lg">{product.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="capitalize">
                          {product.roast_level} roast
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {product.origin}
                        </span>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="border border-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Size</TableHead>
                          <TableHead>Grind Type</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-center">Stock</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(variants[product.id] || []).map((variant) => (
                          <TableRow key={variant.id}>
                            <TableCell className="font-medium">{variant.size}</TableCell>
                            <TableCell>{grindLabels[variant.grind_type] || variant.grind_type}</TableCell>
                            <TableCell className="text-right">Rs. {variant.price.toFixed(2)}</TableCell>
                            <TableCell className="text-center">{variant.stock_count}</TableCell>
                            <TableCell className="text-center">
                              {getStockBadge(variant.stock_count)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditVariant(variant)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {products.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No products found</p>
            </div>
          )}
        </div>
      </main>

      {/* Edit Variant Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Variant</DialogTitle>
          </DialogHeader>

          {editingVariant && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Size</Label>
                  <p className="font-medium">{editingVariant.size}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Grind Type</Label>
                  <p className="font-medium">
                    {grindLabels[editingVariant.grind_type] || editingVariant.grind_type}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price (Rs.)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={editingVariant.price}
                  onChange={(e) =>
                    setEditingVariant({
                      ...editingVariant,
                      price: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stock">Stock Count</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={editingVariant.stock_count}
                  onChange={(e) =>
                    setEditingVariant({
                      ...editingVariant,
                      stock_count: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveVariant} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInventory;

