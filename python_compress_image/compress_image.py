import os
import sys
import threading
from datetime import datetime
from PIL import Image
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from tkinterdnd2 import TkinterDnD, DND_FILES
import json


SUPPORTED_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")
CONFIG_FILE = "config.json"

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except:
            return {}
    return {}


def save_config(input_path, output_path):
    config = {
        "input_folder": input_path,
        "output_folder": output_path
    }
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f)
    except:
        pass


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
    files = [
        f for f in os.listdir(input_dir)
        if f.lower().endswith(SUPPORTED_EXTENSIONS)
    ]

    total = len(files)
    if total == 0:
        return 0, 0

    original_bytes = 0
    compressed_bytes = 0

    os.makedirs(output_dir, exist_ok=True)

    for i, filename in enumerate(files, 1):
        input_path = os.path.join(input_dir, filename)
        original_bytes += os.path.getsize(input_path)

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

        compressed_bytes += os.path.getsize(output_path)
        progress.set((i / total) * 100)

    return original_bytes, compressed_bytes


def start_compression():
    if not input_var.get() or not output_var.get():
        messagebox.showerror("Error", "Please select input and output folders")
        return

    progress.set(0)

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    final_output_dir = os.path.join(
        output_var.get(),
        f"compressed_images_{timestamp}"
    )
    os.makedirs(final_output_dir, exist_ok=True)

    def task():
        original, compressed = compress_images(
            input_var.get(),
            final_output_dir,
            quality_var.get(),
            resize_var.get(),
            width_var.get(),
            height_var.get(),
            ratio_var.get(),
            progress
        )

        if original == 0:
            messagebox.showwarning("No Images", "No supported images found.")
            return

        # =====================
        # AUTO DELETE FEATURE
        # =====================
        if auto_delete_var.get():
            for f in os.listdir(input_var.get()):
                full_path = os.path.join(input_var.get(), f)
                if os.path.isfile(full_path):
                    try:
                        os.remove(full_path)
                    except Exception as e:
                        print("Delete failed:", e)

        saved = original - compressed
        percent = (saved / original) * 100

        # =====================
        # COMPRESSION REPORT
        # =====================
        messagebox.showinfo(
            "Compression Report",
            f"Compression Complete ✅\n\n"
            f"Original Size : {original / 1024 / 1024:.2f} MB\n"
            f"Compressed Size : {compressed / 1024 / 1024:.2f} MB\n"
            f"Saved : {saved / 1024 / 1024:.2f} MB\n"
            f"Reduction : {percent:.1f}%\n\n"
            f"Output Folder:\n{final_output_dir}"
        )

        # =====================
        # AUTO OPEN FOLDER FEATURE
        # =====================
        if auto_open_var.get():
            try:
                # Windows
                if os.name == 'nt':
                    os.startfile(final_output_dir)
                else:
                    # macOS
                    if sys.platform == "darwin":
                        os.system(f'open "{final_output_dir}"')
                    else:
                        # Linux
                        os.system(f'xdg-open "{final_output_dir}"')
            except Exception as e:
                print("Could not open folder:", e)

    threading.Thread(target=task, daemon=True).start()

def browse_input():
    folder = filedialog.askdirectory()
    if folder:
        input_var.set(folder)
        save_config(input_var.get(), output_var.get())

def browse_output():
    folder = filedialog.askdirectory()
    if folder:
        output_var.set(folder)
        save_config(input_var.get(), output_var.get())


def drop_input(event):
    path = event.data.strip("{}")
    if os.path.isdir(path):
        input_var.set(path)


# ---------------- GUI ---------------- #

root = TkinterDnD.Tk()
root.title("Advanced Image Compressor")
root.geometry("560x560")
root.resizable(False, False)

input_var = tk.StringVar()
output_var = tk.StringVar()
config = load_config()

if "input_folder" in config:
    input_var.set(config["input_folder"])

if "output_folder" in config:
    output_var.set(config["output_folder"])

quality_var = tk.IntVar(value=10)
resize_var = tk.BooleanVar(value=True)
ratio_var = tk.BooleanVar(value=True)
width_var = tk.IntVar(value=1280)
height_var = tk.IntVar(value=1280)
auto_delete_var = tk.BooleanVar(value=True)
auto_open_var = tk.BooleanVar(value=True)

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


tk.Checkbutton(root, text="Auto delete input images after compress", variable=auto_delete_var).pack(pady=4)
tk.Checkbutton(root, text="Auto open output folder after compress", variable=auto_open_var).pack(pady=4)

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

tk.Checkbutton(
    root,
    text="Keep Aspect Ratio",
    variable=ratio_var
).pack(pady=4)

# Progress
tk.Label(root, text="Progress").pack(pady=6)
ttk.Progressbar(
    root,
    variable=progress,
    maximum=100,
    length=450
).pack(pady=4)

# Start Button
tk.Button(
    root,
    text="Compress Images",
    command=start_compression,
    bg="#4CAF50",
    fg="white",
    height=2,
    width=22
).pack(pady=18)

root.mainloop()
