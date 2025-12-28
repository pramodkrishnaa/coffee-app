import { Link } from "react-router-dom";

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  image: string;
  roastLevel?: "light" | "medium" | "dark";
  delay?: number;
}

const roastColors = {
  light: "bg-accent-green",
  medium: "bg-accent-blue",
  dark: "bg-accent-red",
};

const ProductCard = ({ id, name, price, image, roastLevel, delay = 0 }: ProductCardProps) => {
  return (
    <Link 
      to={`/product/${id}`}
      className="group block animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="hover-lift">
        {/* Product Image */}
        <div className="aspect-square overflow-hidden rounded-lg bg-secondary/50 relative">
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {roastLevel && (
            <span 
              className={`absolute top-3 left-3 ${roastColors[roastLevel]} text-primary-foreground text-xs font-medium px-3 py-1 rounded-full uppercase tracking-wider`}
            >
              {roastLevel}
            </span>
          )}
        </div>

        {/* Product Info */}
        <div className="mt-4 text-center">
          <h3 className="font-body text-sm font-semibold text-foreground uppercase tracking-wider">
            {name}
          </h3>
          <p className="mt-1 font-body text-base text-foreground/80">
            Rs. {price.toFixed(2)}
          </p>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
