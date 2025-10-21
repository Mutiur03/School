import * as React from "react";

function SvgComponent(props) {
  return (
    <svg
      fill="hsl(228, 97%, 42%)"
      viewBox="0 0 24 24"
      className="w-6 h-8"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx={4} cy={12} r={3}>
        <animate
          id="b"
          begin="0;a.end-0.25s"
          attributeName="r"
          dur="0.75s"
          values="3;.2;3"
        />
      </circle>
      <circle cx={12} cy={12} r={3}>
        <animate
          begin="b.end-0.6s"
          attributeName="r"
          dur="0.75s"
          values="3;.2;3"
        />
      </circle>
      <circle cx={20} cy={12} r={3}>
        <animate
          id="a"
          begin="b.end-0.45s"
          attributeName="r"
          dur="0.75s"
          values="3;.2;3"
        />
      </circle>
    </svg>
  );
}

export default SvgComponent;
