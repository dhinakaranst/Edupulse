import { cn } from "@sms/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

const alertVariants = cva(
	"relative flex w-full items-start gap-3 rounded-none border px-4 py-3 text-sm",
	{
		variants: {
			variant: {
				default: "bg-background text-foreground",
				destructive:
					"border-destructive/50 bg-destructive/5 text-destructive dark:border-destructive [&>svg]:text-destructive",
				success:
					"border-emerald-500/50 bg-emerald-500/5 text-emerald-600 dark:text-emerald-500 [&>svg]:text-emerald-500",
				warning:
					"border-yellow-500/50 bg-yellow-500/5 text-yellow-600 dark:text-yellow-500 [&>svg]:text-yellow-500",
				info: "border-primary/50 bg-primary/5 text-primary [&>svg]:text-primary",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Alert({
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div
			data-slot="alert"
			role="alert"
			className={cn(alertVariants({ variant }), className)}
			{...props}
		/>
	);
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-title"
			className={cn("font-semibold leading-none tracking-tight", className)}
			{...props}
		/>
	);
}

function AlertDescription({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-description"
			className={cn("text-xs leading-relaxed opacity-90", className)}
			{...props}
		/>
	);
}

export { Alert, AlertTitle, AlertDescription };
