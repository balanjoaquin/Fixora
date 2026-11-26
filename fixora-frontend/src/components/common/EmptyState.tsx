interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] border border-[#DBEAFE] flex items-center justify-center text-[#2563EB] mb-4">
        {icon}
      </div>
      <h3 className="text-base font-bold text-[#0F172A] mb-1.5">{title}</h3>
      <p className="text-sm text-[#475569] max-w-sm leading-relaxed mb-5">{description}</p>
      {action}
    </div>
  );
}
