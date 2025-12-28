import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link 
            to="/terms" 
            className="font-body text-sm hover:underline transition-all duration-200"
          >
            Terms and Policies
          </Link>
          <span className="font-body text-sm">
            © 2025 TINY TIGER
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
