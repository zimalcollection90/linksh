'use client'
import { UserCircle, LogOut, LayoutDashboard, Settings } from 'lucide-react'
import { Button } from './ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from './ui/dropdown-menu'
import { createClient } from '../../supabase/client'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from 'next/link'

interface UserProfileProps {
    user?: any;
    profile?: any;
}

export default function UserProfile({ user, profile }: UserProfileProps) {
    const supabase = createClient()
    const router = useRouter()

    const displayName = profile?.display_name || profile?.full_name || user?.email?.split("@")[0] || "User";
    const initials = displayName.slice(0, 2).toUpperCase();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full border border-white/10 hover:border-white/20">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={profile?.avatar_url} alt={displayName} />
                        <AvatarFallback className="bg-purple-600/20 text-purple-400 text-xs font-bold">{initials}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-zinc-900 border-white/10 text-white">
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{displayName}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {user?.email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem asChild className="hover:bg-white/5 cursor-pointer">
                    <Link href="/dashboard" className="flex w-full items-center">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="hover:bg-white/5 cursor-pointer">
                    <Link href="/dashboard/settings" className="flex w-full items-center">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem 
                    className="text-red-400 focus:text-red-400 hover:bg-red-400/10 cursor-pointer"
                    onClick={async () => {
                        await supabase.auth.signOut()
                        router.push('/')
                        router.refresh()
                    }}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}