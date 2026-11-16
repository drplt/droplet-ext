/** A small droplet, so the empty state reads as Droplet's without a logo asset. */
const DropletMark = () => (
  <svg className="empty__mark" viewBox="0 0 32 32" aria-hidden="true">
    <path
      d="M16 3.5c-.6 0-1.1.3-1.5.8C11.3 8.6 6.5 15 6.5 19.5a9.5 9.5 0 0 0 19 0C25.5 15 20.7 8.6 17.5 4.3c-.4-.5-.9-.8-1.5-.8Z"
      fill="currentColor"
      opacity="0.14"
    />
    <path
      d="M16 3.5c-.6 0-1.1.3-1.5.8C11.3 8.6 6.5 15 6.5 19.5a9.5 9.5 0 0 0 19 0C25.5 15 20.7 8.6 17.5 4.3c-.4-.5-.9-.8-1.5-.8Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
    <path
      d="M11.5 20a4.5 4.5 0 0 0 4.5 4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

export { DropletMark };
