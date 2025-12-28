import ProductCard from "./ProductCard";

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  roastLevel?: "light" | "medium" | "dark";
}

interface ProductGridProps {
  products: Product[];
}

const ProductGrid = ({ products }: ProductGridProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          {...product}
          delay={index * 100}
        />
      ))}
    </div>
  );
};

export default ProductGrid;
