# Test fixture photographs

Two real photographs, used to exercise byte-level upload validation and the
material-analysis contract with genuine image data rather than a synthetic file.

| File | Source | Notes |
|---|---|---|
| `small-plywood-offcuts.jpg` | [Stacked wood.JPG](https://commons.wikimedia.org/wiki/File:Stacked_wood.JPG) on Wikimedia Commons | Downscaled to 900 px on the long edge and re-encoded as JPEG |
| `small-corrugated-cardboard.jpg` | [Corrugated Cardboard.JPG](https://commons.wikimedia.org/wiki/File:Corrugated_Cardboard.JPG) on Wikimedia Commons | Downscaled to 900 px on the long edge and re-encoded as JPEG |

Both were downloaded from Wikimedia Commons via `Special:FilePath`, which serves
the original file. They were then downscaled locally — the same operation the
browser performs before upload — so the fixtures stay small enough to commit.

These files are **test fixtures only**. They are not part of the product, they are
never shown to a user, and the licence of the originals should be checked on the
file pages above before this repository is redistributed. If the licence is not
suitable for distribution, delete both files: the test that uses them skips
gracefully when they are absent.
