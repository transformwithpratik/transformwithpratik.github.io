#include <stdio.h>
#include <stdlib.h>
#include <float.h>
#include <math.h>
// reads: n m d, then A (n*d floats), B (m*d floats) from binary file; writes path pairs
int main(int argc,char**argv){
  FILE*f=fopen(argv[1],"rb"); int n,m,d; fread(&n,4,1,f); fread(&m,4,1,f); fread(&d,4,1,f);
  float*A=malloc(sizeof(float)*n*d),*B=malloc(sizeof(float)*m*d); fread(A,4,n*d,f); fread(B,4,m*d,f); fclose(f);
  float*D=malloc(sizeof(float)*(size_t)n*m); unsigned char*P=malloc((size_t)n*m);
  for(int i=0;i<n;i++) for(int j=0;j<m;j++){
    float c=0; float na=0,nb=0,dot=0; for(int k=0;k<d;k++){ float a=A[i*d+k],b=B[j*d+k]; dot+=a*b; na+=a*a; nb+=b*b; }
    c=1.0f-dot/(sqrtf(na*nb)+1e-9f);
    float best=FLT_MAX; unsigned char p=0;
    if(i==0&&j==0){best=0;}
    if(i>0&&j>0&&D[(size_t)(i-1)*m+j-1]<best){best=D[(size_t)(i-1)*m+j-1];p=0;}
    if(i>0&&D[(size_t)(i-1)*m+j]+0.0f<best){best=D[(size_t)(i-1)*m+j];p=1;}
    if(j>0&&D[(size_t)i*m+j-1]+0.0f<best){best=D[(size_t)i*m+j-1];p=2;}
    float w = (p==0)?2.0f:1.0f;
    D[(size_t)i*m+j]=best+c*w; P[(size_t)i*m+j]=p;
  }
  FILE*o=fopen(argv[2],"w"); int i=n-1,j=m-1;
  while(i>0||j>0){ fprintf(o,"%d %d\n",i,j); unsigned char p=P[(size_t)i*m+j]; if(p==0){i--;j--;} else if(p==1) i--; else j--; }
  fprintf(o,"0 0\n"); fclose(o);
  return 0;
}
