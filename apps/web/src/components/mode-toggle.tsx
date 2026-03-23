import { Button } from "@sms/ui/components/button";
import { Contrast } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ModeToggle() {
	const { theme, setTheme } = useTheme();

	const toggleTheme = () => {
		setTheme(theme === "dark" ? "light" : "dark");
	};

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={toggleTheme}
			className="rounded-full"
		>
			<Contrast className="h-[1.2rem] w-[1.2rem] transition-all" />
			<span className="sr-only">Toggle theme</span>
		</Button>
	);
}
