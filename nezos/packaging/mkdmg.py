"""Write a .dmg from a staging folder without macOS tools.

The image is ISO 9660 with Rock Ridge (POSIX names, permissions, symlinks)
and Joliet. macOS's DiskImageMounter opens it like any .dmg; Rock Ridge keeps
the executable bit on Nezos.app/Contents/MacOS/nezos and the Applications
symlink for drag-to-install.

usage: python3 mkdmg.py <staging-dir> <out.dmg> <volume-name>
"""
import io
import os
import stat
import sys

import pycdlib


def main(src, out, volume):
    iso = pycdlib.PyCdlib()
    iso.new(interchange_level=3, rock_ridge='1.09', joliet=3, vol_ident=volume.upper()[:32])
    counter = [0]

    def iso_name(is_dir):
        counter[0] += 1
        return ('D%06d' if is_dir else 'F%06d.;1') % counter[0]

    def walk(host_dir, iso_dir, joliet_dir):
        for name in sorted(os.listdir(host_dir)):
            host = os.path.join(host_dir, name)
            st = os.lstat(host)
            joliet = joliet_dir.rstrip('/') + '/' + name[:64]
            if stat.S_ISLNK(st.st_mode):
                iso.add_symlink(iso_dir.rstrip('/') + '/' + iso_name(False).replace('.;1', ''), rr_symlink_name=name,
                                rr_path=os.readlink(host), joliet_path=joliet)
            elif stat.S_ISDIR(st.st_mode):
                path = iso_dir.rstrip('/') + '/' + iso_name(True)
                iso.add_directory(path, rr_name=name, joliet_path=joliet, file_mode=0o40755)
                walk(host, path, joliet)
            else:
                with open(host, 'rb') as f:
                    data = f.read()
                mode = 0o100755 if st.st_mode & 0o111 else 0o100644
                iso.add_fp(io.BytesIO(data), len(data), iso_dir.rstrip('/') + '/' + iso_name(False),
                           rr_name=name, joliet_path=joliet, file_mode=mode)

    walk(src, '/', '/')
    iso.write(out)
    iso.close()
    print('wrote', out, os.path.getsize(out), 'bytes')


if __name__ == '__main__':
    main(*sys.argv[1:4])
