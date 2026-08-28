import os
import threading
from PIL import Image
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from tkinterdnd2 import TkinterDnD, DND_FILES
from datetime import datetime


SUPPORTED_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")


def compress_images(
    input_dir,
    output_dir,
    quality,
    resize,
    width,
    height,
    keep_ratio,
    progress
):
    files = [f for f in os.listdir(input_dir)
             if f.lower().endswith(SUPPORTED_EXTENSIONS)]

    total = len(files)
    if total == 0:
        return

    os.makedirs(output_dir, exist_ok=True)

    for i, filename in enumerate(files, 1):
        input_path = os.path.join(input_dir, filename)

        # Force JPEG output for max compression
        name, _ = os.path.splitext(filename)
        output_path = os.path.join(output_dir, f"{name}.jpg")

        with Image.open(input_path) as img:
            img = img.convert("RGB")

            if resize:
                if keep_ratio:
                    img.thumbnail((width, height), Image.LANCZOS)
                else:
                    img = img.resize((width, height), Image.LANCZOS)

            img.save(
                output_path,
                format="JPEG",
                quality=quality,
                optimize=True,
                progressive=True
            )

        progress.set((i / total) * 100)


def start_compression():
    if not input_var.get() or not output_var.get():
        messagebox.showerror("Error", "Please select input and output folders")
        return

    progress.set(0)

    # Auto-generate unique folder name using timestamp
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    final_output_dir = os.path.join(
        output_var.get(),
        f"compressed_images_{timestamp}"
    )

    os.makedirs(final_output_dir, exist_ok=True)

    def task():
        compress_images(
            input_var.get(),
            final_output_dir,
            quality_var.get(),
            resize_var.get(),
            width_var.get(),
            height_var.get(),
            ratio_var.get(),
            progress
        )

        messagebox.showinfo(
            "Done",
            f"Compression complete!\nImages saved in:\n{final_output_dir}"
        )

    threading.Thread(target=task, daemon=True).start()


def browse_input():
    input_var.set(filedialog.askdirectory())


def browse_output():
    output_var.set(filedialog.askdirectory())


def drop_input(event):
    path = event.data.strip("{}")
    if os.path.isdir(path):
        input_var.set(path)


# ---------------- GUI ---------------- #

root = TkinterDnD.Tk()
root.title("Advanced Image Compressor")
root.geometry("560x540")
root.resizable(False, False)

input_var = tk.StringVar()
output_var = tk.StringVar()
quality_var = tk.IntVar(value=10)

resize_var = tk.BooleanVar(value=True)
ratio_var = tk.BooleanVar(value=True)
width_var = tk.IntVar(value=640)
height_var = tk.IntVar(value=640)

progress = tk.DoubleVar()

# Input Folder
tk.Label(root, text="Input Folder (Drag & Drop Supported)").pack(pady=6)
input_entry = tk.Entry(root, textvariable=input_var, width=60)
input_entry.pack()
input_entry.drop_target_register(DND_FILES)
input_entry.dnd_bind("<<Drop>>", drop_input)
tk.Button(root, text="Browse", command=browse_input).pack(pady=4)

# Output Folder
tk.Label(root, text="Output Folder").pack(pady=6)
tk.Entry(root, textvariable=output_var, width=60).pack()
tk.Button(root, text="Browse", command=browse_output).pack(pady=4)

# Quality
tk.Label(root, text="Image Quality (Lower = Smaller)").pack(pady=6)
tk.Scale(root, from_=10, to=100, orient="horizontal",
         variable=quality_var).pack()

# Resize Options
tk.Checkbutton(root, text="Resize Images", variable=resize_var).pack(pady=4)

resize_frame = tk.Frame(root)
resize_frame.pack()

tk.Label(resize_frame, text="Max Width").grid(row=0, column=0, padx=5)
tk.Entry(resize_frame, textvariable=width_var, width=6).grid(row=0, column=1)

tk.Label(resize_frame, text="Max Height").grid(row=0, column=2, padx=5)
tk.Entry(resize_frame, textvariable=height_var, width=6).grid(row=0, column=3)

tk.Checkbutton(root, text="Keep Aspect Ratio",
               variable=ratio_var).pack(pady=4)

# Progress
tk.Label(root, text="Progress").pack(pady=6)
ttk.Progressbar(root, variable=progress,
                maximum=100, length=450).pack(pady=4)

# Start Button
tk.Button(
    root,
    text="Compress Images",
    command=start_compression,
    bg="#4CAF50",
    fg="white",
    height=2,
    width=22
).pack(pady=15)

root.mainloop()