import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProductGrid from "@/components/products/ProductGrid";
import { products } from "@/data/products";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useMemo } from "react";

const Index = () => {
  const [roastFilter, setRoastFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("default");

  const filteredAndSortedProducts = useMemo(() => {
    // Per PRD: max 3 products (first 3 from products array)
    let result = [...products].slice(0, 3);

    // Filter by roast level
    if (roastFilter !== "all") {
      result = result.filter((p) => p.roastLevel === roastFilter);
    }

    // Sort
    switch (sortBy) {
      case "price-low":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        result.sort((a, b) => b.price - a.price);
        break;
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break;
    }

    return result;
  }, [roastFilter, sortBy]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        {/* Header Section */}
        <section className="pt-16 pb-12 px-4">
          <div className="container mx-auto text-center max-w-3xl">
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold text-foreground mb-6 animate-fade-in">
              Our Products
            </h1>
            <p className="font-body text-base md:text-lg text-muted-foreground leading-relaxed animate-fade-in-up">
              Each of our products is a testament to our love for quality and flavor. 
              From the finest single-origin beans to expertly crafted blends, 
              discover the perfect cup that speaks to your palate.
            </p>
          </div>
        </section>

        {/* Filters Section */}
        <section className="pb-8 px-4">
          <div className="container mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border">
              <div className="flex flex-wrap items-center gap-4">
                <Select value={roastFilter} onValueChange={setRoastFilter}>
                  <SelectTrigger className="w-[160px] bg-background border-border">
                    <SelectValue placeholder="Roast Level" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">All Roasts</SelectItem>
                    <SelectItem value="light">Light Roast</SelectItem>
                    <SelectItem value="medium">Medium Roast</SelectItem>
                    <SelectItem value="dark">Dark Roast</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[160px] bg-background border-border">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="name">Name: A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Product Grid Section */}
        <section className="pb-16 px-4">
          <div className="container mx-auto">
            <ProductGrid products={filteredAndSortedProducts} />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
