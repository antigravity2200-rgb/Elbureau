/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#f4d125",
                "primary-dark": "#e0c010",
                "background-light": "#fdfbf6", // Warmer cream
                "background-dark": "#1a1a1a",
                "paper-white": "#ffffff",
                "paper-border": "#181711",
                "text-main": "#181711",
                "ink": "#181711",
                "pop-red": "#ff6b6b",
                "pop-blue": "#4ecdc4",
                "pop-green": "#c7f464",
                "pop-purple": "#a29bfe",
            },
            fontFamily: {
                "display": ["Spline Sans", "Noto Sans", "sans-serif"],
                "marker": ["Permanent Marker", "cursive"],
                "hand": ["Architects Daughter", "cursive"],
                "fun": ["Fredoka", "sans-serif"],
            },
            borderRadius: {
                "DEFAULT": "0.75rem",
                "lg": "1rem",
                "xl": "1.5rem",
                "2xl": "2rem",
                "full": "9999px",
                "sketchy": "255px 15px 225px 15px / 15px 225px 15px 255px",
                "sketchy-sm": "25px 5px 22px 5px / 5px 22px 5px 25px",
                "sketchy-md": "35px 10px 32px 10px / 10px 32px 10px 35px"
            },
            boxShadow: {
                'sketch': '2px 2px 0px 0px #181711',
                'sketch-sm': '1px 1px 0px 0px #181711',
                'sketch-md': '3px 3px 0px 0px #181711',
                'sketch-lg': '5px 5px 0px 0px #181711',
                'sketch-xl': '8px 8px 0px 0px #181711',
                'sketch-active': '0px 0px 0px 0px #181711',
            },
            backgroundImage: {
                'paper-pattern': "url('data:image/svg+xml,%3Csvg width=\\'64\\' height=\\'64\\' viewBox=\\'0 0 64 64\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cpath d=\\'M8 16c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8zm0-2c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6zm33.414-6l5.95-5.95L45.95.636 40 6.586 34.05.636 32.636 2.05 38.586 8l-5.95 5.95 1.414 1.414L40 9.414l5.95 5.95 1.414-1.414L41.414 8zM40 48c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8zm0-2c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6zM9.414 40l5.95-5.95-1.414-1.414L8 38.586l-5.95-5.95L.636 34.05 6.586 40l-5.95 5.95 1.414 1.414L8 41.414l5.95 5.95 1.414-1.414L9.414 40z\\' fill=\\'%239C92AC\\' fill-opacity=\\'0.03\\' fill-rule=\\'evenodd\\'/%3E%3C/svg%3E')",
                'scribble': "url('data:image/svg+xml,%3Csvg width=\\'100\\' height=\\'100\\' viewBox=\\'0 0 100 100\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cpath d=\\'M10,50 Q25,25 50,50 T90,50\\' fill=\\'none\\' stroke=\\'black\\' stroke-width=\\'2\\' /%3E%3C/svg%3E')"
            },
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'float-delayed': 'float 7s ease-in-out infinite 1s',
                'wiggle': 'wiggle 3s ease-in-out infinite',
                'pop-in': 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                'slide-up': 'slideUp 0.5s ease-out forwards',
                'subtle-shake': 'subtle-shake 2s ease-in-out infinite',
                'slide-in-down': 'slideInDown 0.5s ease-out forwards',
                'fade-in': 'fadeIn 0.5s ease-out forwards',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
                    '50%': { transform: 'translateY(-6px) rotate(1deg)' },
                },
                wiggle: {
                    '0%, 100%': { transform: 'rotate(-1deg)' },
                    '50%': { transform: 'rotate(1deg)' },
                },
                popIn: {
                    '0%': { opacity: '0', transform: 'scale(0.8) translateY(10px)' },
                    '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'subtle-shake': {
                    '0%, 100%': { transform: 'rotate(-1deg)' },
                    '50%': { transform: 'rotate(1deg)' },
                },
                slideInDown: {
                    '0%': { opacity: '0', transform: 'translateY(-20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                }
            }
        }
    },
    plugins: [],
}
