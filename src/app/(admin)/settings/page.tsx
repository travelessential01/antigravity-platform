import Link from 'next/link'
import { Settings2, BookOpen } from 'lucide-react'

export default function AdminSettings() {
    return (
        <div className= "p-6 max-w-4xl" >
        <h1 className="text-2xl font-bold text-slate-900 mb-2" > System Administration </h1>
            < p className = "text-sm text-slate-500 mb-8" > Manage global platform settings and clinical compliance configurations.</p>

                < div className = "grid grid-cols-1 sm:grid-cols-2 gap-4" >
                    <Link
                    href="/settings/sla-config"
    className = "group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all"
        >
        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors" >
            <Settings2 className="w-5 h-5 text-indigo-600" />
                </div>
                < div >
                <p className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors" >
                    SLA Configuration
                        </p>
                        < p className = "mt-0.5 text-xs text-slate-500" >
                            Adjust NABH - bounded acknowledgement and resolution thresholds.
                        </p>
                                </div>
                                </Link>

                    <Link
                    href="/faq-management"
    className = "group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-violet-400 hover:shadow-md transition-all"
        >
        <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center group-hover:bg-violet-100 transition-colors" >
            <BookOpen className="w-5 h-5 text-violet-600" />
                </div>
                < div >
                <p className="font-semibold text-slate-800 group-hover:text-violet-700 transition-colors" >
                    FAQ Management
                        </p>
                        < p className = "mt-0.5 text-xs text-slate-500" >
                            Create, edit, and publish frequently asked questions for patients and staff.
                        </p>
                                </div>
                                </Link>
                                </div>
                                </div>
    )
}
