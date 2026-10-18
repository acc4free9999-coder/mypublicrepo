import AppKit
import PDFKit
import CryptoKit
import Foundation

struct Figure: Decodable {
    let id: String
    let page: Int
    let image: Int
    let crop: [Double]
    let title: String
}
struct Manifest: Decodable {
    let source: String
    let referenceSize: [Double]
    let figures: [Figure]
}
let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let manifestData = try Data(contentsOf: root.appendingPathComponent("teaching/source-figures.json"))
let manifest = try JSONDecoder().decode(Manifest.self, from: manifestData)
let source = root.appendingPathComponent(manifest.source)
let sourceData = try Data(contentsOf: source)
guard let pdf = PDFDocument(data: sourceData) else { fatalError("Cannot open source PDF") }
let output = root.appendingPathComponent("units/source-figures")
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
var records: [[String: Any]] = []
for figure in manifest.figures {
    guard figure.crop.count == 4, let page = pdf.page(at: figure.page - 1) else { fatalError("Invalid figure \(figure.id)") }
    let image = page.thumbnail(of: NSSize(width: 1980, height: 2562), for: .mediaBox)
    guard let tiff = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff), let cg = bitmap.cgImage else { fatalError("Cannot render page \(figure.page)") }
    let box = figure.crop
    let rect = CGRect(x: box[0] / manifest.referenceSize[0] * Double(cg.width),
                      y: box[1] / manifest.referenceSize[1] * Double(cg.height),
                      width: box[2] / manifest.referenceSize[0] * Double(cg.width),
                      height: box[3] / manifest.referenceSize[1] * Double(cg.height)).integral
    guard rect.minX >= 0, rect.minY >= 0, rect.maxX <= Double(cg.width), rect.maxY <= Double(cg.height),
          let cropped = cg.cropping(to: rect),
          let png = NSBitmapImageRep(cgImage: cropped).representation(using: .png, properties: [:]) else { fatalError("Invalid crop \(figure.id)") }
    try png.write(to: output.appendingPathComponent("\(figure.id).png"))
    records.append(["id": figure.id, "page": figure.page, "image": figure.image, "crop": figure.crop,
                    "width": cropped.width, "height": cropped.height,
                    "sha256": SHA256.hash(data: png).map { String(format: "%02x", $0) }.joined()])
}
let provenance: [String: Any] = [
    "source": manifest.source,
    "sourceSha256": SHA256.hash(data: sourceData).map { String(format: "%02x", $0) }.joined(),
    "referenceSize": manifest.referenceSize,
    "coordinateOrigin": "top-left",
    "figures": records
]
try JSONSerialization.data(withJSONObject: provenance, options: [.prettyPrinted, .sortedKeys]).write(to: output.appendingPathComponent("provenance.json"))
print("Cropped \(records.count) source figures; source text and complete pages are not reproduced.")
