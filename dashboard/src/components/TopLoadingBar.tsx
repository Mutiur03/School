import { motion } from "framer-motion";

const TopLoadingBar = () => {
  return (
    <motion.div
      initial={{ width: "0%" }}
      animate={{
        width: ["0%", "30%", "60%", "85%"],
        transition: {
          duration: 10,
          ease: "linear",
          times: [0, 0.1, 0.3, 1]
        }
      }}
      className="fixed top-0 left-0 h-1 bg-primary z-9999 shadow-[0_0_10px_#3b82f6]"
      style={{
        background: "linear-gradient(90deg, var(--primary) 0%, #60a5fa 100%)",
      }}
    />
  );
};

export default TopLoadingBar;
